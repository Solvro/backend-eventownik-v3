import { BlocksService } from "src/blocks/blocks.service";
import type { Event, Form } from "src/generated/prisma/client";
import { ParticipantsService } from "src/participants/participants.service";
import { PrismaService } from "src/prisma/prisma.service";
import { StorageService } from "src/storage/storage.service";

import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { FormsService } from "./forms.service";

describe("FormsService registration form (integration)", () => {
  let service: FormsService;
  let prisma: PrismaService;

  const createdEventUuids: string[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormsService,
        ParticipantsService,
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

      const form = await service.create(event.uuid, {
        name: "First",
        isFirstForm: true,
        attributes: [],
      });

      expect(await registerFormUuidOf(event.uuid)).toBe(form.uuid);
    });

    it("replaces the current registration form", async () => {
      const event = await createEvent();
      await service.create(event.uuid, {
        name: "Old first",
        isFirstForm: true,
        attributes: [],
      });

      const replacement = await service.create(event.uuid, {
        name: "New first",
        isFirstForm: true,
        attributes: [],
      });

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

      await service.update(next.uuid, event.uuid, { isFirstForm: true });

      expect(await registerFormUuidOf(event.uuid)).toBe(next.uuid);
    });

    it("clears the registration form when the current one is set to isFirstForm false", async () => {
      const event = await createEvent();
      const current = await createForm(event.uuid);
      await prisma.event.update({
        where: { uuid: event.uuid },
        data: { registerFormUuid: current.uuid },
      });

      await service.update(current.uuid, event.uuid, { isFirstForm: false });

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

      await service.update(other.uuid, event.uuid, { isFirstForm: false });

      expect(await registerFormUuidOf(event.uuid)).toBe(current.uuid);
    });
  });
});
