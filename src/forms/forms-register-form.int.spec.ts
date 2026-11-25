import { AuditLogService } from "src/audit-log/audit-log.service";
import type { AuditActor } from "src/audit-log/audit-log.types";
import { BlocksService } from "src/blocks/blocks.service";
import { LogTrigger } from "src/generated/prisma/client";
import type { Event, Form } from "src/generated/prisma/client";
import { ParticipantsService } from "src/participants/participants.service";
import { PrismaService } from "src/prisma/prisma.service";
import { StorageService } from "src/storage/storage.service";

import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { FormsService } from "./forms.service";

const ACTOR: AuditActor = {
  type: LogTrigger.ADMIN,
  uuid: "00000000-0000-4000-8000-0000000000aa",
  name: "Test Admin",
};

describe("FormsService registration form (integration)", () => {
  let service: FormsService;
  let prisma: PrismaService;

  const createdEventUuids: string[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormsService,
        ParticipantsService,
        AuditLogService,
        BlocksService,
        PrismaService,
        { provide: StorageService, useValue: {} },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue("test-bucket") },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<FormsService>(FormsService);
    prisma = module.get<PrismaService>(PrismaService);
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
        name: "Test Event",
        slug: `forms-register-int-${String(Date.now())}-${Math.random().toString(36).slice(2)}`,
        startDate: new Date("2025-06-01"),
        endDate: new Date("2025-06-02"),
      },
    });
    createdEventUuids.push(event.uuid);
    return event;
  }

  async function createForm(eventUuid: string): Promise<Form> {
    return prisma.form.create({ data: { name: "Test Form", eventUuid } });
  }

  async function registerFormUuidOf(eventUuid: string) {
    const event = await prisma.event.findUnique({ where: { uuid: eventUuid } });
    return event?.registerFormUuid;
  }

  describe("create", () => {
    it("sets the new form as the registration form", async () => {
      const event = await createEvent();

      const form = await service.create(
        event.uuid,
        {
          name: "First",
          isFirstForm: true,
          attributes: [],
        },
        ACTOR,
      );

      expect(await registerFormUuidOf(event.uuid)).toBe(form.uuid);
    });

    it("replaces the current registration form", async () => {
      const event = await createEvent();
      await service.create(
        event.uuid,
        {
          name: "Old first",
          isFirstForm: true,
          attributes: [],
        },
        ACTOR,
      );

      const replacement = await service.create(
        event.uuid,
        {
          name: "New first",
          isFirstForm: true,
          attributes: [],
        },
        ACTOR,
      );

      expect(await registerFormUuidOf(event.uuid)).toBe(replacement.uuid);
    });
  });

  describe("update", () => {
    it("replaces the current registration form when isFirstForm is true", async () => {
      const event = await createEvent();
      const current = await createForm(event.uuid);
      const next = await createForm(event.uuid);
      await prisma.event.update({
        where: { uuid: event.uuid },
        data: { registerFormUuid: current.uuid },
      });

      await service.update(next.uuid, event.uuid, { isFirstForm: true }, ACTOR);

      expect(await registerFormUuidOf(event.uuid)).toBe(next.uuid);
    });

    it("clears the registration form when the current one is set to isFirstForm false", async () => {
      const event = await createEvent();
      const current = await createForm(event.uuid);
      await prisma.event.update({
        where: { uuid: event.uuid },
        data: { registerFormUuid: current.uuid },
      });

      await service.update(
        current.uuid,
        event.uuid,
        { isFirstForm: false },
        ACTOR,
      );

      expect(await registerFormUuidOf(event.uuid)).toBeNull();
    });

    it("keeps the registration form when a different form is set to isFirstForm false", async () => {
      const event = await createEvent();
      const current = await createForm(event.uuid);
      const other = await createForm(event.uuid);
      await prisma.event.update({
        where: { uuid: event.uuid },
        data: { registerFormUuid: current.uuid },
      });

      await service.update(
        other.uuid,
        event.uuid,
        { isFirstForm: false },
        ACTOR,
      );

      expect(await registerFormUuidOf(event.uuid)).toBe(current.uuid);
    });
  });
  describe("audit log", () => {
    it("records forms with attribute changes and the registration flag", async () => {
      const event = await createEvent();
      const first = await prisma.attribute.create({
        data: { eventUuid: event.uuid, name: "Size", type: "text", order: 1 },
      });
      const second = await prisma.attribute.create({
        data: { eventUuid: event.uuid, name: "Diet", type: "text", order: 2 },
      });

      const form = await service.create(
        event.uuid,
        {
          name: "Signup",
          attributes: [
            { attributeUuid: first.uuid, isRequired: true, order: 1 },
          ],
        },
        ACTOR,
      );
      await service.update(
        form.uuid,
        event.uuid,
        {
          isFirstForm: true,
          attributes: [
            { attributeUuid: first.uuid, isRequired: true, order: 1 },
            { attributeUuid: second.uuid, isRequired: false, order: 2 },
          ],
        },
        ACTOR,
      );
      await service.remove(form.uuid, event.uuid, ACTOR);

      const entries = await prisma.auditLog.findMany({
        where: { eventUuid: event.uuid },
        orderBy: { createdAt: "asc" },
      });

      expect(entries.map((entry) => entry.action)).toEqual([
        "form.created",
        "form.updated",
        "form.deleted",
      ]);
      expect(entries[1].changes).toEqual(
        expect.arrayContaining([
          { kind: "value", field: "isFirstForm", from: false, to: true },
          {
            kind: "list",
            field: "attributes",
            added: [{ name: "Diet", isRequired: false }],
            removed: [],
          },
        ]),
      );
      expect(entries[2]).toMatchObject({
        entityLabel: "Signup",
        entityUuid: form.uuid,
      });
    });
  });
});
