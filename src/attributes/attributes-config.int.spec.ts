import { BlocksService } from "src/blocks/blocks.service";
import type { Attribute, Event } from "src/generated/prisma/client";
import { AttributeType } from "src/generated/prisma/enums";
import { ParticipantsService } from "src/participants/participants.service";
import { PrismaService } from "src/prisma/prisma.service";

import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { AttributesService } from "./attributes.service";

describe("AttributesService config handling (integration)", () => {
  let service: AttributesService;
  let prisma: PrismaService;

  const createdEventUuids: string[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttributesService,
        BlocksService,
        PrismaService,
        { provide: ParticipantsService, useValue: {} },
      ],
    }).compile();

    service = module.get<AttributesService>(AttributesService);
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
        slug: `attributes-config-int-${String(Date.now())}-${Math.random().toString(36).slice(2)}`,
        startDate: new Date("2025-06-01"),
        endDate: new Date("2025-06-02"),
      },
    });
    createdEventUuids.push(event.uuid);
    return event;
  }

  async function createAttribute(
    eventUuid: string,
    type: AttributeType,
    config: object,
  ): Promise<Attribute> {
    return prisma.attribute.create({
      data: { eventUuid, type, name: "Attribute", order: 1, config },
    });
  }

  async function storedConfig(uuid: string) {
    const attribute = await prisma.attribute.findUnique({ where: { uuid } });
    return attribute?.config;
  }

  describe("update", () => {
    it("keeps a block config when the update omits it", async () => {
      const event = await createEvent();
      const config = { maxSelections: 3, participantFields: ["email"] };
      const attribute = await createAttribute(
        event.uuid,
        AttributeType.block,
        config,
      );

      await service.update(attribute.uuid, event.uuid, { name: "Renamed" });

      expect(await storedConfig(attribute.uuid)).toEqual(config);
    });

    it("keeps a select config when the update omits it", async () => {
      const event = await createEvent();
      const config = { options: ["a", "b"], allowOther: true };
      const attribute = await createAttribute(
        event.uuid,
        AttributeType.select,
        config,
      );

      await service.update(attribute.uuid, event.uuid, { order: 5 });

      expect(await storedConfig(attribute.uuid)).toEqual(config);
    });

    it("replaces the config when one is sent", async () => {
      const event = await createEvent();
      const attribute = await createAttribute(
        event.uuid,
        AttributeType.select,
        { options: ["a"] },
      );

      await service.update(attribute.uuid, event.uuid, {
        config: { options: ["x", "y"] },
      });

      expect(await storedConfig(attribute.uuid)).toEqual({
        options: ["x", "y"],
      });
    });

    it("resets the config when the type changes without one", async () => {
      const event = await createEvent();
      const attribute = await createAttribute(event.uuid, AttributeType.block, {
        maxSelections: 3,
      });

      await service.update(attribute.uuid, event.uuid, {
        type: AttributeType.text,
      });

      expect(await storedConfig(attribute.uuid)).toEqual({});
    });
  });

  describe("bulkUpdate", () => {
    it("keeps configs when items only change the order", async () => {
      const event = await createEvent();
      const config = { options: ["a", "b"] };
      const attribute = await createAttribute(
        event.uuid,
        AttributeType.multiSelect,
        config,
      );

      await service.bulkUpdate(event.uuid, [
        { uuid: attribute.uuid, order: 9 },
      ]);

      expect(await storedConfig(attribute.uuid)).toEqual(config);
    });
  });
});
