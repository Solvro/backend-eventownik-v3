/**
 * Real-database integration tests for OrganizersService.
 *
 * These tests hit an actual PostgreSQL database, so they verify that:
 *   - Prisma queries are valid against the real schema
 *   - Unique constraints and FK constraints behave as expected
 *   - Transactions work correctly (e.g. create + permission assignment is atomic)
 *
 * Prerequisites
 * -------------
 * DATABASE_URL must point to a test database with migrations applied.
 *   - Locally: copy .env.test.example → .env.test and adjust the URL.
 *   - CI: DATABASE_URL is injected automatically (see .github/workflows/ci.yml).
 *
 * Isolation
 * ---------
 * Each test creates its own records with unique identifiers (UUID-based email /
 * slug suffixes). Cleanup runs once after all tests in this file and is scoped
 * to only the records created here, making it safe to run in parallel with other
 * spec files.
 */

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import type { Admin, Event } from "src/generated/prisma/client";
import { PermissionType } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import { OrganizerListingDto } from "./dto/organizer-listing.dto";
import { OrganizersService } from "./organizers.service";

describe("OrganizersService (integration)", () => {
  let service: OrganizersService;
  let prisma: PrismaService;

  // Tracked so afterAll only deletes what this suite created.
  const createdAdminUuids: string[] = [];
  const createdEventUuids: string[] = [];

  // ---------------------------------------------------------------------------
  // Module setup / teardown
  // ---------------------------------------------------------------------------

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      // Only the pieces under test — no mocks, real PrismaService.
      providers: [OrganizersService, PrismaService],
    }).compile();

    service = module.get<OrganizersService>(OrganizersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // Delete in FK-safe order.
    // EventPermission has no onDelete cascade on its relations, so it must go first.
    await prisma.eventPermission.deleteMany({
      where: {
        OR: [
          { eventUuid: { in: createdEventUuids } },
          { adminUuid: { in: createdAdminUuids } },
        ],
      },
    });
    await prisma.event.deleteMany({
      where: { uuid: { in: createdEventUuids } },
    });
    await prisma.admin.deleteMany({
      where: { uuid: { in: createdAdminUuids } },
    });

    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // Helpers / factories
  //
  // Every helper pushes created UUIDs into the tracking arrays so afterAll
  // knows what to clean up.
  // ---------------------------------------------------------------------------

  async function createAdmin(
    overrides: Partial<{
      firstName: string;
      lastName: string;
      email: string;
      active: boolean;
    }> = {},
  ): Promise<Admin> {
    const admin = await prisma.admin.create({
      data: {
        firstName: "Test",
        lastName: "Organizer",
        // Unique per call — prevents collisions even across parallel workers.
        email: `${Date.now()}-${Math.random().toString(36).slice(2)}@organizers-int.local`,
        // Not a real hash — organizer tests never touch auth logic.
        password: "$2b$10$placeholder.not.used.in.organizer.tests.only",
        active: true,
        ...overrides,
      },
    });
    createdAdminUuids.push(admin.uuid);
    return admin;
  }

  async function createEvent(
    organizerUuid: string,
    overrides: Partial<{
      name: string;
      slug: string;
      startDate: Date;
      endDate: Date;
    }> = {},
  ): Promise<Event> {
    const event = await prisma.event.create({
      data: {
        name: "Test Event",
        slug: `organizers-int-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        startDate: new Date("2025-06-01"),
        endDate: new Date("2025-06-02"),
        organizerUuid,
        ...overrides,
      },
    });
    createdEventUuids.push(event.uuid);
    return event;
  }

  // Directly inserts EventPermission rows, bypassing service logic.
  // Used to set up preconditions without going through the service under test.
  async function assignPermissions(
    adminUuid: string,
    eventUuid: string,
    permissions: PermissionType[] = [PermissionType.MANAGE_EVENT],
  ): Promise<void> {
    await prisma.eventPermission.createMany({
      data: permissions.map((permission) => ({
        adminUuid,
        eventUuid,
        permission,
      })),
    });
  }

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------

  describe("findAll", () => {
    it("returns all organizers assigned to the event", async () => {
      // owner is linked via the events relation (organizerUuid field).
      // coOrganizer is linked via an EventPermission row.
      const owner = await createAdmin();
      const coOrganizer = await createAdmin();
      const event = await createEvent(owner.uuid);
      await assignPermissions(coOrganizer.uuid, event.uuid);

      const result = await service.findAll(
        event.uuid,
        new OrganizerListingDto(),
      );

      expect(result.meta.itemCount).toBe(2);
      const emails = result.data.map((o) => o.email);
      expect(emails).toContain(owner.email);
      expect(emails).toContain(coOrganizer.email);
    });

    it("omits the password field from every returned organizer", async () => {
      const owner = await createAdmin();
      const event = await createEvent(owner.uuid);

      const result = await service.findAll(
        event.uuid,
        new OrganizerListingDto(),
      );

      for (const organizer of result.data) {
        expect(organizer).not.toHaveProperty("password");
      }
    });

    it("throws NotFoundException when the event does not exist", async () => {
      const nonExistentUuid = "00000000-0000-0000-0000-000000000000";

      await expect(
        service.findAll(nonExistentUuid, new OrganizerListingDto()),
      ).rejects.toThrow(NotFoundException);
    });

    it("filters organizers by active status", async () => {
      const active = await createAdmin({ active: true });
      const inactive = await createAdmin({ active: false });
      const event = await createEvent(active.uuid);
      await assignPermissions(inactive.uuid, event.uuid);

      const query = Object.assign(new OrganizerListingDto(), {
        isActive: true,
      });
      const result = await service.findAll(event.uuid, query);

      const emails = result.data.map((o) => o.email);
      expect(emails).toContain(active.email);
      expect(emails).not.toContain(inactive.email);
    });

    it("includes only permissions scoped to the requested event, not other events", async () => {
      const admin = await createAdmin();
      const event = await createEvent(admin.uuid);
      const otherEvent = await createEvent(admin.uuid);
      await assignPermissions(admin.uuid, event.uuid, [
        PermissionType.MANAGE_FORM,
      ]);
      await assignPermissions(admin.uuid, otherEvent.uuid, [
        PermissionType.MANAGE_EMAIL,
      ]);

      const result = await service.findAll(
        event.uuid,
        new OrganizerListingDto(),
      );

      const organizer = result.data.find((o) => o.email === admin.email);
      expect(organizer).toBeDefined();
      const types = organizer!.permissions.map((p) => p.permission);
      expect(types).toContain(PermissionType.MANAGE_FORM);
      expect(types).not.toContain(PermissionType.MANAGE_EMAIL);
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------

  describe("findOne", () => {
    it("returns the organizer when assigned to the event", async () => {
      const admin = await createAdmin();
      const event = await createEvent(admin.uuid);
      await assignPermissions(admin.uuid, event.uuid);

      const result = await service.findOne(event.uuid, admin.uuid);

      expect(result.uuid).toBe(admin.uuid);
      expect(result.email).toBe(admin.email);
      expect(result).not.toHaveProperty("password");
    });

    it("throws NotFoundException when admin exists but is not assigned to the event", async () => {
      const owner = await createAdmin();
      const unassigned = await createAdmin();
      const event = await createEvent(owner.uuid);
      // unassigned has no relation to event

      await expect(
        service.findOne(event.uuid, unassigned.uuid),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException for a non-existent admin uuid", async () => {
      const owner = await createAdmin();
      const event = await createEvent(owner.uuid);
      const fakeAdminUuid = "00000000-0000-0000-0000-000000000001";

      await expect(service.findOne(event.uuid, fakeAdminUuid)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe("create", () => {
    it("assigns an admin as organizer with the specified permissions", async () => {
      const owner = await createAdmin();
      const newOrganizer = await createAdmin();
      const event = await createEvent(owner.uuid);

      const result = await service.create(event.uuid, {
        email: newOrganizer.email,
        permissions: [
          PermissionType.MANAGE_PARTICIPANT,
          PermissionType.MANAGE_FORM,
        ],
      });

      expect(result).toBeDefined();
      expect(result!.uuid).toBe(newOrganizer.uuid);
      const types = result!.permissions.map((p) => p.permission);
      expect(types).toContain(PermissionType.MANAGE_PARTICIPANT);
      expect(types).toContain(PermissionType.MANAGE_FORM);
    });

    it("throws NotFoundException when no admin has that email", async () => {
      const owner = await createAdmin();
      const event = await createEvent(owner.uuid);

      await expect(
        service.create(event.uuid, {
          email: "nobody@organizers-int.local",
          permissions: [PermissionType.MANAGE_EVENT],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException when the event does not exist", async () => {
      const admin = await createAdmin();
      const fakeEventUuid = "00000000-0000-0000-0000-000000000002";

      await expect(
        service.create(fakeEventUuid, {
          email: admin.email,
          permissions: [PermissionType.MANAGE_EVENT],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException when a permission already exists (unique constraint violation)", async () => {
      const owner = await createAdmin();
      const organizer = await createAdmin();
      const event = await createEvent(owner.uuid);
      // Pre-seed the permission directly so we can trigger the conflict.
      await assignPermissions(organizer.uuid, event.uuid, [
        PermissionType.MANAGE_EVENT,
      ]);

      await expect(
        service.create(event.uuid, {
          email: organizer.email,
          permissions: [PermissionType.MANAGE_EVENT], // duplicate — hits P2002
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe("update", () => {
    it("replaces all permissions for an organizer", async () => {
      const owner = await createAdmin();
      const organizer = await createAdmin();
      const event = await createEvent(owner.uuid);
      await assignPermissions(organizer.uuid, event.uuid, [
        PermissionType.MANAGE_EVENT,
      ]);

      const result = await service.update(event.uuid, organizer.uuid, {
        permissions: [
          PermissionType.MANAGE_PARTICIPANT,
          PermissionType.MANAGE_EMAIL,
        ],
      });

      expect(result).toBeDefined();
      const types = result!.permissions.map((p) => p.permission);
      expect(types).not.toContain(PermissionType.MANAGE_EVENT); // old one gone
      expect(types).toContain(PermissionType.MANAGE_PARTICIPANT);
      expect(types).toContain(PermissionType.MANAGE_EMAIL);
    });

    it("throws NotFoundException when the event does not exist", async () => {
      const organizer = await createAdmin();
      const fakeEventUuid = "00000000-0000-0000-0000-000000000003";

      await expect(
        service.update(fakeEventUuid, organizer.uuid, {
          permissions: [PermissionType.MANAGE_EVENT],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException when the organizer is not assigned to the event", async () => {
      const owner = await createAdmin();
      const unassigned = await createAdmin();
      const event = await createEvent(owner.uuid);

      await expect(
        service.update(event.uuid, unassigned.uuid, {
          permissions: [PermissionType.MANAGE_EVENT],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------

  describe("remove", () => {
    it("removes the organizer's EventPermission rows when other organizers remain", async () => {
      const owner = await createAdmin();
      const organizer = await createAdmin();
      const event = await createEvent(owner.uuid);
      await assignPermissions(organizer.uuid, event.uuid);

      await service.remove(event.uuid, organizer.uuid);

      // Verify directly in the DB that the rows are gone.
      const remaining = await prisma.eventPermission.findMany({
        where: { adminUuid: organizer.uuid, eventUuid: event.uuid },
      });
      expect(remaining).toHaveLength(0);
    });

    it("throws ForbiddenException when trying to remove the last organizer", async () => {
      const owner = await createAdmin();
      // createEvent sets event.organizerUuid = owner.uuid, which makes owner the
      // sole organizer via the events relation. No EventPermission rows needed.
      const event = await createEvent(owner.uuid);

      await expect(service.remove(event.uuid, owner.uuid)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("throws NotFoundException when the organizer is not assigned to the event", async () => {
      const owner = await createAdmin();
      const unassigned = await createAdmin();
      const event = await createEvent(owner.uuid);

      await expect(service.remove(event.uuid, unassigned.uuid)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
