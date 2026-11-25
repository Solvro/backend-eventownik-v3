import { AuditAction } from "src/audit-log/audit-log.constants";
import { AuditLogService } from "src/audit-log/audit-log.service";
import type { AuditActor } from "src/audit-log/audit-log.types";
import { AttributeType, LogTrigger } from "src/generated/prisma/client";
import type { Event, Prisma } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { StorageService } from "src/storage/storage.service";

import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";

import { ParticipantsService } from "./participants.service";

describe("ParticipantsService audit log (integration)", () => {
  let service: ParticipantsService;
  let prisma: PrismaService;

  const createdEventUuids: string[] = [];
  const admin: AuditActor = {
    type: LogTrigger.ADMIN,
    uuid: "11111111-1111-4111-8111-111111111111",
    name: "Jan Kowalski",
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParticipantsService,
        AuditLogService,
        PrismaService,
        {
          provide: StorageService,
          useValue: {
            delete: jest.fn(),
            getUrl: jest.fn((_bucket: string, key: string) => key),
            extractKey: jest.fn((_bucket: string, value: string) => value),
          },
        },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue("test-bucket") },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get(ParticipantsService);
    prisma = module.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.event.deleteMany({
      where: { uuid: { in: createdEventUuids } },
    });
    await prisma.$disconnect();
  });

  async function createEvent(): Promise<Event> {
    const event = await prisma.event.create({
      data: {
        name: "Audit Participants",
        slug: `audit-participants-${String(Date.now())}-${Math.random().toString(36).slice(2)}`,
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-06-02"),
      },
    });
    createdEventUuids.push(event.uuid);
    return event;
  }

  async function createAttribute(
    eventUuid: string,
    type: AttributeType,
    name: string,
    config?: Prisma.InputJsonValue,
  ) {
    return prisma.attribute.create({
      data: { eventUuid, type, name, order: 1, config },
    });
  }

  async function entries(eventUuid: string) {
    return prisma.auditLog.findMany({
      where: { eventUuid },
      orderBy: { createdAt: "asc" },
    });
  }

  it("logs admin creation with attribute values", async () => {
    const event = await createEvent();
    const attribute = await createAttribute(
      event.uuid,
      AttributeType.text,
      "Nick",
    );

    const participant = await service.create(
      event.uuid,
      {
        email: "created@example.com",
        participantAttributes: [
          { attributeUuid: attribute.uuid, value: "jan" },
        ],
      },
      admin,
    );

    const [entry] = await entries(event.uuid);
    expect(entry).toMatchObject({
      action: AuditAction.ParticipantCreated,
      actorType: LogTrigger.ADMIN,
      actorUuid: admin.uuid,
      actorName: "Jan Kowalski",
      entityUuid: participant.uuid,
      entityLabel: "created@example.com",
    });
    expect(entry.changes).toMatchObject([
      { field: "email", from: null, to: "created@example.com" },
      { field: "Nick", kind: "value", from: null, to: "jan" },
    ]);
  });

  it("logs self registration with the participant as actor", async () => {
    const event = await createEvent();

    const participant = await service.register(event.uuid, "self@example.com");

    const [entry] = await entries(event.uuid);
    expect(entry).toMatchObject({
      action: AuditAction.ParticipantRegistered,
      actorType: LogTrigger.PARTICIPANT,
      actorUuid: participant.uuid,
      actorName: "self@example.com",
    });
  });

  it("logs only changed values on update and nothing when unchanged", async () => {
    const event = await createEvent();
    const text = await createAttribute(event.uuid, AttributeType.text, "Nick");
    const multi = await createAttribute(
      event.uuid,
      AttributeType.multiSelect,
      "Diet",
      { options: ["a", "b", "c"] },
    );
    const participant = await service.create(
      event.uuid,
      {
        email: "update@example.com",
        participantAttributes: [
          { attributeUuid: text.uuid, value: "jan" },
          { attributeUuid: multi.uuid, value: ["a", "b"] },
        ],
      },
      admin,
    );

    await service.update(
      event.uuid,
      participant.uuid,
      {
        participantAttributes: [
          { attributeUuid: text.uuid, value: "jan" },
          { attributeUuid: multi.uuid, value: ["b", "c"] },
        ],
      },
      { actor: admin },
    );

    const all = await entries(event.uuid);
    expect(all).toHaveLength(2);
    expect(all[1].action).toBe(AuditAction.ParticipantUpdated);
    expect(all[1].changes).toMatchObject([
      { kind: "list", field: "Diet", added: ["c"], removed: ["a"] },
    ]);

    await service.update(
      event.uuid,
      participant.uuid,
      { participantAttributes: [{ attributeUuid: text.uuid, value: "jan" }] },
      { actor: admin },
    );
    expect(await entries(event.uuid)).toHaveLength(2);
  });

  it("fills the participant actor name on self updates", async () => {
    const event = await createEvent();
    const participant = await service.register(event.uuid, "named@example.com");

    await service.update(
      event.uuid,
      participant.uuid,
      { email: "renamed@example.com" },
      { actor: { type: LogTrigger.PARTICIPANT, uuid: participant.uuid } },
    );

    const all = await entries(event.uuid);
    expect(all[1]).toMatchObject({
      actorType: LogTrigger.PARTICIPANT,
      actorName: "named@example.com",
    });
    expect(all[1].changes).toMatchObject([
      { field: "email", from: "named@example.com", to: "renamed@example.com" },
    ]);
  });

  it("keeps the log after the participant is removed", async () => {
    const event = await createEvent();
    const participant = await service.create(
      event.uuid,
      { email: "gone@example.com" },
      admin,
    );

    await service.remove(event.uuid, participant.uuid, admin);

    const all = await entries(event.uuid);
    expect(all.map((entry) => entry.action)).toEqual([
      AuditAction.ParticipantCreated,
      AuditAction.ParticipantDeleted,
    ]);
    expect(all[1].entityLabel).toBe("gone@example.com");
  });

  it("shares a correlation id across bulk removals and bulk updates", async () => {
    const event = await createEvent();
    const attribute = await createAttribute(
      event.uuid,
      AttributeType.text,
      "Nick",
    );
    const first = await service.create(
      event.uuid,
      { email: "a@example.com" },
      admin,
    );
    const second = await service.create(
      event.uuid,
      { email: "b@example.com" },
      admin,
    );

    await service.bulkUpdateAttributes(
      event.uuid,
      attribute.uuid,
      "same",
      [first.uuid, second.uuid],
      admin,
    );
    await service.removeMany(event.uuid, [first.uuid, second.uuid], admin);

    const all = await entries(event.uuid);
    const updates = all.filter(
      (entry) => entry.action === AuditAction.ParticipantUpdated,
    );
    const deletions = all.filter(
      (entry) => entry.action === AuditAction.ParticipantDeleted,
    );
    expect(updates).toHaveLength(2);
    expect(updates[0].correlationId).not.toBeNull();
    expect(updates[0].correlationId).toBe(updates[1].correlationId);
    expect(deletions).toHaveLength(2);
    expect(deletions[0].correlationId).toBe(deletions[1].correlationId);
  });
});
