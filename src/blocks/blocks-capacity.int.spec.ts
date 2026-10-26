import type { Attribute, Block, Event } from "src/generated/prisma/client";
import { AttributeType } from "src/generated/prisma/enums";
import { ParticipantsService } from "src/participants/participants.service";
import { PrismaService } from "src/prisma/prisma.service";

import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { BlocksService } from "./blocks.service";

describe("BlocksService capacity (integration)", () => {
  let service: BlocksService;
  let prisma: PrismaService;

  const createdEventUuids: string[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlocksService,
        PrismaService,
        { provide: ParticipantsService, useValue: {} },
      ],
    }).compile();

    service = module.get<BlocksService>(BlocksService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await prisma.event.deleteMany({
      where: { uuid: { in: createdEventUuids } },
    });
    await prisma.$disconnect();
  });

  async function createBlockAttribute(): Promise<{
    event: Event;
    attribute: Attribute;
    root: Block;
  }> {
    const event = await prisma.event.create({
      data: {
        name: "Test Event",
        slug: `blocks-capacity-int-${String(Date.now())}-${Math.random().toString(36).slice(2)}`,
        startDate: new Date("2025-06-01"),
        endDate: new Date("2025-06-02"),
      },
    });
    createdEventUuids.push(event.uuid);
    const attribute = await prisma.attribute.create({
      data: {
        eventUuid: event.uuid,
        type: AttributeType.block,
        name: "Rooms",
        order: 1,
        config: { maxSelections: 1 },
      },
    });
    const root = await prisma.block.create({
      data: {
        name: "Root",
        attributeUuid: attribute.uuid,
        isRootBlock: true,
        order: 0,
      },
    });
    return { event, attribute, root };
  }

  async function createBlock(
    attribute: Attribute,
    parent: Block,
    capacity: number | null,
  ): Promise<Block> {
    return prisma.block.create({
      data: {
        name: "Room",
        attributeUuid: attribute.uuid,
        parentUuid: parent.uuid,
        capacity,
      },
    });
  }

  async function signUpParticipant(
    event: Event,
    attribute: Attribute,
    block: Block,
  ) {
    await prisma.participant.create({
      data: {
        email: `${Math.random().toString(36).slice(2)}@blocks-capacity.local`,
        eventUuid: event.uuid,
        attributes: {
          create: { attributeUuid: attribute.uuid, value: [block.uuid] },
        },
      },
    });
  }

  describe("canSignInToBlock", () => {
    it("allows signing in to a block without a capacity", async () => {
      const { event, attribute, root } = await createBlockAttribute();
      const block = await createBlock(attribute, root, null);
      await signUpParticipant(event, attribute, block);

      const result = await service.canSignInToBlock(
        event.uuid,
        attribute.uuid,
        block.uuid,
      );

      expect(result).toBe(true);
    });

    it("allows signing in while seats remain", async () => {
      const { event, attribute, root } = await createBlockAttribute();
      const block = await createBlock(attribute, root, 2);
      await signUpParticipant(event, attribute, block);

      const result = await service.canSignInToBlock(
        event.uuid,
        attribute.uuid,
        block.uuid,
      );

      expect(result).toBe(true);
    });

    it("rejects signing in once the capacity is reached", async () => {
      const { event, attribute, root } = await createBlockAttribute();
      const block = await createBlock(attribute, root, 1);
      await signUpParticipant(event, attribute, block);

      const result = await service.canSignInToBlock(
        event.uuid,
        attribute.uuid,
        block.uuid,
      );

      expect(result).toBe(false);
    });

    it("rejects signing in to the root block", async () => {
      const { event, attribute, root } = await createBlockAttribute();

      const result = await service.canSignInToBlock(
        event.uuid,
        attribute.uuid,
        root.uuid,
      );

      expect(result).toBe(false);
    });
  });

  describe("getBlockTree", () => {
    it("reports the participant count for blocks without a capacity", async () => {
      const { event, attribute, root } = await createBlockAttribute();
      const block = await createBlock(attribute, root, null);
      await signUpParticipant(event, attribute, block);

      const tree = await service.getBlockTree(event.slug, attribute.uuid);

      const child = (
        tree as { children: { uuid: string; blockParticipantCount?: number }[] }
      ).children.find((candidate) => candidate.uuid === block.uuid);
      expect(child?.blockParticipantCount).toBe(1);
    });
  });
});
