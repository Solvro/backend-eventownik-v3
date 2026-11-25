import { PERMISSIONS_KEY } from "src/auth/permissions.decorator";
import type { PermissionsMetadata } from "src/auth/permissions.decorator";
import { LogTrigger, PermissionType } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";

import { SYSTEM_ACTOR, adminActor, participantActor } from "./audit-actor";
import { AuditLogQueryService } from "./audit-log-query.service";
import { AuditAction, AuditEntityType } from "./audit-log.constants";
import { AuditLogController } from "./audit-log.controller";
import { AuditLogService } from "./audit-log.service";
import { AuditLogListingDto } from "./dto/audit-log-listing.dto";

function listing(overrides: Partial<AuditLogListingDto> = {}) {
  return Object.assign(new AuditLogListingDto(), overrides);
}

describe("AuditLog (integration)", () => {
  let service: AuditLogService;
  let queryService: AuditLogQueryService;
  let prisma: PrismaService;

  const createdEventUuids: string[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditLogService, AuditLogQueryService, PrismaService],
    }).compile();

    service = module.get(AuditLogService);
    queryService = module.get(AuditLogQueryService);
    prisma = module.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.event.deleteMany({
      where: { uuid: { in: createdEventUuids } },
    });
    await prisma.$disconnect();
  });

  async function createEvent() {
    const event = await prisma.event.create({
      data: {
        name: "Audit Event",
        slug: `audit-int-${String(Date.now())}-${Math.random().toString(36).slice(2)}`,
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-06-02"),
      },
    });
    createdEventUuids.push(event.uuid);
    return event;
  }

  it("requires MANAGE_ALL on the controller", () => {
    const meta = Reflect.getMetadata(PERMISSIONS_KEY, AuditLogController) as
      PermissionsMetadata | undefined;

    expect(meta?.permissions).toEqual([PermissionType.MANAGE_ALL]);
  });

  it("throws NotFound for an unknown event", async () => {
    await expect(
      queryService.findAll("00000000-0000-4000-8000-000000000000", listing()),
    ).rejects.toThrow(NotFoundException);
  });

  it("records entries scoped to the event, newest first", async () => {
    const event = await createEvent();
    const other = await createEvent();
    const actor = adminActor({
      uuid: "11111111-1111-4111-8111-111111111111",
      firstName: "Jan",
      lastName: "Kowalski",
    });

    await prisma.$transaction(async (tx) => {
      await service.record(tx, {
        eventUuid: event.uuid,
        action: AuditAction.EventCreated,
        actor,
        entityType: AuditEntityType.Event,
        entityUuid: event.uuid,
        entityLabel: event.name,
      });
      await service.record(tx, {
        eventUuid: event.uuid,
        action: AuditAction.EventUpdated,
        actor,
        entityType: AuditEntityType.Event,
        entityUuid: event.uuid,
        changes: service.fieldChanges({ name: "A" }, { name: "B" }, ["name"]),
      });
      await service.record(tx, {
        eventUuid: other.uuid,
        action: AuditAction.EventCreated,
        actor,
        entityType: AuditEntityType.Event,
      });
    });

    const page = await queryService.findAll(event.uuid, listing());

    expect(page.meta.itemCount).toBe(2);
    expect(page.data[0].action).toBe(AuditAction.EventUpdated);
    expect(page.data[0].actor).toEqual({
      type: LogTrigger.ADMIN,
      uuid: actor.uuid,
      name: "Jan Kowalski",
    });
    expect(page.data[0].changes).toEqual([
      { kind: "value", field: "name", from: "A", to: "B" },
    ]);
    expect(page.data[1].changes).toEqual([]);
  });

  it("filters by action, entity and actor type, and paginates", async () => {
    const event = await createEvent();
    const participantUuid = "22222222-2222-4222-8222-222222222222";
    const admin = adminActor({
      uuid: "11111111-1111-4111-8111-111111111111",
    });
    const participant = participantActor({
      uuid: participantUuid,
      email: "p@example.com",
    });

    await prisma.$transaction(async (tx) => {
      await service.recordMany(tx, [
        {
          eventUuid: event.uuid,
          action: AuditAction.ParticipantDeleted,
          actor: admin,
          entityType: AuditEntityType.Participant,
          entityUuid: participantUuid,
        },
        {
          eventUuid: event.uuid,
          action: AuditAction.ParticipantUpdated,
          actor: participant,
          entityType: AuditEntityType.Participant,
          entityUuid: participantUuid,
        },
        {
          eventUuid: event.uuid,
          action: AuditAction.AttributeCreated,
          actor: admin,
          entityType: AuditEntityType.Attribute,
        },
      ]);
    });

    const byAction = await queryService.findAll(
      event.uuid,
      listing({ action: [AuditAction.ParticipantDeleted] }),
    );
    expect(byAction.data.map((entry) => entry.action)).toEqual([
      AuditAction.ParticipantDeleted,
    ]);

    const byEntity = await queryService.findAll(
      event.uuid,
      listing({ entityUuid: participantUuid }),
    );
    expect(byEntity.meta.itemCount).toBe(2);

    const byActorType = await queryService.findAll(
      event.uuid,
      listing({ actorType: LogTrigger.PARTICIPANT }),
    );
    expect(byActorType.data).toHaveLength(1);
    expect(byActorType.data[0].actor.name).toBe("p@example.com");

    const secondPage = await queryService.findAll(
      event.uuid,
      listing({ page: 2, take: 2 }),
    );
    expect(secondPage.data).toHaveLength(1);
    expect(secondPage.meta.hasPreviousPage).toBe(true);
  });

  it("pages through entries sharing a timestamp without repeats or gaps", async () => {
    const event = await createEvent();
    const createdAt = new Date("2026-03-01T10:00:00.000Z");
    await prisma.auditLog.createMany({
      data: Array.from({ length: 7 }, () => ({
        eventUuid: event.uuid,
        action: AuditAction.EventUpdated,
        actorType: LogTrigger.SYSTEM,
        entityType: AuditEntityType.Event,
        createdAt,
      })),
    });

    const seen: string[] = [];
    for (const page of [1, 2, 3, 4]) {
      const result = await queryService.findAll(
        event.uuid,
        listing({ page, take: 2 }),
      );
      seen.push(...result.data.map((entry) => entry.uuid));
    }

    expect(seen).toHaveLength(7);
    expect(new Set(seen).size).toBe(7);
  });

  it("filters by date range", async () => {
    const event = await createEvent();
    await prisma.auditLog.create({
      data: {
        eventUuid: event.uuid,
        action: AuditAction.EventUpdated,
        actorType: LogTrigger.SYSTEM,
        entityType: AuditEntityType.Event,
        createdAt: new Date("2020-01-01"),
      },
    });

    const result = await queryService.findAll(
      event.uuid,
      listing({ from: new Date("2021-01-01") }),
    );

    expect(result.meta.itemCount).toBe(0);
  });

  it("removes entries together with the event", async () => {
    const event = await createEvent();
    await prisma.$transaction(async (tx) => {
      await service.record(tx, {
        eventUuid: event.uuid,
        action: AuditAction.EventCreated,
        actor: SYSTEM_ACTOR,
        entityType: AuditEntityType.Event,
      });
    });

    await prisma.event.delete({ where: { uuid: event.uuid } });

    expect(
      await prisma.auditLog.count({ where: { eventUuid: event.uuid } }),
    ).toBe(0);
  });

  it("resolves block and file names when building attribute changes", async () => {
    const event = await createEvent();
    const blockAttribute = await prisma.attribute.create({
      data: {
        eventUuid: event.uuid,
        name: "Workshops",
        type: "block",
        order: 1,
      },
    });
    const block = await prisma.block.create({
      data: { name: "Workshop A", attributeUuid: blockAttribute.uuid },
    });

    const changes = await prisma.$transaction(async (tx) =>
      service.attributeValueChanges(tx, [
        {
          attribute: {
            uuid: blockAttribute.uuid,
            name: blockAttribute.name,
            type: blockAttribute.type,
          },
          before: [],
          after: [block.uuid],
        },
      ]),
    );

    expect(changes).toMatchObject([
      {
        kind: "blocks",
        added: [{ uuid: block.uuid, name: "Workshop A" }],
        removed: [],
      },
    ]);
  });
});
