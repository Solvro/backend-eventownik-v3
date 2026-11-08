import * as bcrypt from "bcrypt";
import type { AuthUser } from "src/auth/jwt.strategy";
import type { Admin } from "src/generated/prisma/client";
import { OrganizerType } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import { ConflictException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";

import { AdminsService } from "./admins.service";
import { ListAdminDto } from "./dto/list-admin.dto";
import { UpdateAdminDto } from "./dto/update-admin.dto";

describe("AdminsService (integration)", () => {
  let service: AdminsService;
  let prisma: PrismaService;

  const createdAdminUuids: string[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminsService, PrismaService],
    }).compile();

    service = module.get<AdminsService>(AdminsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await prisma.admin.deleteMany({
      where: { uuid: { in: createdAdminUuids } },
    });
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // Factories
  // ---------------------------------------------------------------------------

  async function createAdmin(
    overrides: Partial<{
      firstName: string;
      lastName: string;
      email: string;
      type: OrganizerType;
      active: boolean;
    }> = {},
  ): Promise<Admin> {
    const admin = await prisma.admin.create({
      data: {
        firstName: "Test",
        lastName: "Admin",
        email: `${String(Date.now())}-${Math.random().toString(36).slice(2)}@admins-int.local`,
        password: "$2b$10$placeholder.not.a.real.hash.for.tests",
        type: OrganizerType.organizer,
        active: true,
        ...overrides,
      },
    });
    createdAdminUuids.push(admin.uuid);
    return admin;
  }

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe("create", () => {
    it("creates an admin and hashes the password", async () => {
      const email = `${String(Date.now())}-create@admins-int.local`;

      const result = await service.create({
        firstName: "Jane",
        lastName: "Doe",
        email,
        password: "securepassword",
        type: OrganizerType.organizer,
        active: true,
      });

      createdAdminUuids.push(result.uuid);

      expect(result.uuid).toBeDefined();
      expect(result.email).toBe(email);
      const match = await bcrypt.compare("securepassword", result.password);
      expect(match).toBe(true);
    });

    it("throws ConflictException when the email already exists", async () => {
      const existing = await createAdmin();

      await expect(
        service.create({
          firstName: "Duplicate",
          lastName: "Admin",
          email: existing.email,
          password: "somepassword",
          type: OrganizerType.organizer,
          active: true,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------

  describe("findAll", () => {
    it("returns admins with correct pagination metadata", async () => {
      const admin = await createAdmin();

      const result = await service.findAll(new ListAdminDto());

      expect(result.meta.itemCount).toBeGreaterThanOrEqual(1);
      const uuids = result.data.map((a) => a.uuid);
      expect(uuids).toContain(admin.uuid);
    });

    it("filters by email (case-insensitive partial match)", async () => {
      const unique = `filter-email-${String(Date.now())}`;
      const admin = await createAdmin({ email: `${unique}@admins-int.local` });

      const query = Object.assign(new ListAdminDto(), {
        email: unique.toUpperCase(),
      });
      const result = await service.findAll(query);

      const uuids = result.data.map((a) => a.uuid);
      expect(uuids).toContain(admin.uuid);
    });

    it("filters by firstName (case-insensitive partial match)", async () => {
      const admin = await createAdmin({ firstName: "Bartholomew" });

      const query = Object.assign(new ListAdminDto(), { firstName: "barthol" });
      const result = await service.findAll(query);

      const uuids = result.data.map((a) => a.uuid);
      expect(uuids).toContain(admin.uuid);
    });

    it("filters by lastName", async () => {
      const admin = await createAdmin({ lastName: "Featherstonehaugh" });

      const query = Object.assign(new ListAdminDto(), {
        lastName: "featherstoneh",
      });
      const result = await service.findAll(query);

      const uuids = result.data.map((a) => a.uuid);
      expect(uuids).toContain(admin.uuid);
    });

    it("filters by type, excluding admins of a different type", async () => {
      const superadmin = await createAdmin({ type: OrganizerType.superadmin });
      const organizer = await createAdmin({ type: OrganizerType.organizer });

      const query = Object.assign(new ListAdminDto(), {
        type: OrganizerType.superadmin,
      });
      const result = await service.findAll(query);

      const uuids = result.data.map((a) => a.uuid);
      expect(uuids).toContain(superadmin.uuid);
      expect(uuids).not.toContain(organizer.uuid);
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------

  describe("findOne", () => {
    it("returns the admin when it exists", async () => {
      const admin = await createAdmin();

      const result = await service.findOne(admin.uuid);

      expect(result.uuid).toBe(admin.uuid);
      expect(result.email).toBe(admin.email);
    });

    it("throws NotFoundException when the admin does not exist", async () => {
      await expect(
        service.findOne("00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe("update", () => {
    it("updates admin fields", async () => {
      const admin = await createAdmin();

      const result = await service.update(
        admin.uuid,
        Object.assign(new UpdateAdminDto(), { firstName: "Updated" }),
      );

      expect(result.uuid).toBe(admin.uuid);
      expect(result.firstName).toBe("Updated");
    });

    it("hashes the new password when a non-empty password is provided", async () => {
      const admin = await createAdmin();

      const result = await service.update(
        admin.uuid,
        Object.assign(new UpdateAdminDto(), { password: "newpassword123" }),
      );

      const match = await bcrypt.compare("newpassword123", result.password);
      expect(match).toBe(true);
    });

    it("does not change the password when a blank password is provided", async () => {
      const admin = await createAdmin();

      await service.update(
        admin.uuid,
        Object.assign(new UpdateAdminDto(), { password: "   " }),
      );

      const fresh = await prisma.admin.findUnique({
        where: { uuid: admin.uuid },
      });
      expect(fresh?.password).toBe(admin.password);
    });

    it("throws NotFoundException when the admin does not exist", async () => {
      await expect(
        service.update(
          "00000000-0000-0000-0000-000000000000",
          Object.assign(new UpdateAdminDto(), { firstName: "Ghost" }),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ConflictException when updating to an already-taken email", async () => {
      const a = await createAdmin();
      const b = await createAdmin();

      await expect(
        service.update(
          b.uuid,
          Object.assign(new UpdateAdminDto(), { email: a.email }),
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------

  describe("remove", () => {
    it("deletes the admin from the database", async () => {
      const admin = await createAdmin();
      const currentUser = {
        uuid: "00000000-0000-0000-0000-000000000099",
      } as unknown as AuthUser;

      await service.remove(admin.uuid, currentUser);

      const deleted = await prisma.admin.findUnique({
        where: { uuid: admin.uuid },
      });
      expect(deleted).toBeNull();
    });

    it("throws ConflictException when trying to delete own account", async () => {
      const admin = await createAdmin();
      const currentUser = { uuid: admin.uuid } as unknown as AuthUser;

      await expect(service.remove(admin.uuid, currentUser)).rejects.toThrow(
        ConflictException,
      );
    });

    it("throws NotFoundException when the admin does not exist", async () => {
      const currentUser = {
        uuid: "00000000-0000-0000-0000-000000000099",
      } as unknown as AuthUser;

      await expect(
        service.remove("00000000-0000-0000-0000-000000000000", currentUser),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
