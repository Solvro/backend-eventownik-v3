import { PrismaService } from "src/prisma/prisma.service";

import { NotFoundException } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { BlocksPublicController } from "./block-public.controller";
import { BlocksController } from "./blocks.controller";
import { BlocksService } from "./blocks.service";
import type { CreateBlockDto } from "./dto/create-block.dto";
import type { UpdateBlockDto } from "./dto/update-block.dto";
import type { Block } from "./entities/block.entity";

describe("Blocks Integration", () => {
  let blocksController: BlocksController;
  let blocksPublicController: BlocksPublicController;
  let blocksService: BlocksService;

  const mockPrismaService = {
    block: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    participantAttribute: {
      count: jest.fn(),
    },
    attribute: {
      findFirst: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const eventId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
  const attributeId = "3fa85f64-5717-4562-b3fc-2c963f66afa7";
  const blockId = "3fa85f64-5717-4562-b3fc-2c963f66afa8";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlocksController, BlocksPublicController],
      providers: [
        BlocksService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    blocksController = module.get<BlocksController>(BlocksController);
    blocksService = module.get<BlocksService>(BlocksService);
    blocksPublicController = module.get<BlocksPublicController>(
      BlocksPublicController,
    );

    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a block successfully", async () => {
      const dto: CreateBlockDto = {
        name: "Test Block",
        capacity: 100,
        parentUuid: "some-parent-uuid",
      };

      mockPrismaService.attribute.findFirst.mockResolvedValue({
        uuid: attributeId,
        eventUuid: eventId,
      });
      mockPrismaService.block.create.mockResolvedValue({
        uuid: blockId,
        name: dto.name,
        capacity: dto.capacity,
        attributeUuid: attributeId,
      });

      const result = await blocksController.create(eventId, attributeId, dto);

      expect(mockPrismaService.attribute.findFirst).toHaveBeenCalledWith({
        where: { uuid: attributeId, eventUuid: eventId },
      });
      expect(mockPrismaService.block.create).toHaveBeenCalledWith({
        data: {
          capacity: dto.capacity,
          order: dto.order,
          name: dto.name,
          description: dto.description,
          parentUuid: dto.parentUuid,
          attributeUuid: attributeId,
        },
      });
      expect(result).toHaveProperty("uuid", blockId);
      expect(result).toHaveProperty("name", dto.name);
    });

    it("should throw NotFoundException if attribute or event not found", async () => {
      mockPrismaService.attribute.findFirst.mockResolvedValue(null);
      const dto: CreateBlockDto = {
        name: "Test Block",
        parentUuid: "fake-parent-uuid",
      };

      await expect(
        blocksController.create(eventId, attributeId, dto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("findAll", () => {
    it("should return a nested tree structure of blocks", async () => {
      mockPrismaService.attribute.findFirst.mockResolvedValue({
        uuid: attributeId,
        eventUuid: eventId,
      });

      const mockBlocks = [
        {
          uuid: "root-uuid",
          name: "Root Block",
          isRootBlock: true,
          parentUuid: null,
          order: 0,
          createdAt: new Date("2024-01-01"),
        },
        {
          uuid: "child-uuid",
          name: "Child Block",
          isRootBlock: false,
          parentUuid: "root-uuid",
          order: 1,
          createdAt: new Date("2024-01-02"),
        },
      ];

      mockPrismaService.block.findMany.mockResolvedValue(mockBlocks);

      const result = (await blocksController.findAll(
        eventId,
        attributeId,
      )) as Block;

      expect(mockPrismaService.block.findMany).toHaveBeenCalledWith({
        where: { attributeUuid: attributeId },
      });

      expect(result).toHaveProperty("uuid", "root-uuid");

      const children = result.children;
      expect(children).toBeDefined();
      if (children != null) {
        expect(children).toHaveLength(1);
        expect(children[0]).toHaveProperty("uuid", "child-uuid");
      }
    });
  });

  describe("findOne", () => {
    it("should return a block if found", async () => {
      mockPrismaService.block.findFirst.mockResolvedValue({
        uuid: blockId,
        name: "Test Block",
      });

      const result = await blocksController.findOne(
        eventId,
        attributeId,
        blockId,
      );

      expect(result).toHaveProperty("uuid", blockId);
    });

    it("should throw NotFoundException if block not found", async () => {
      mockPrismaService.block.findFirst.mockResolvedValue(null);

      await expect(
        blocksController.findOne(eventId, attributeId, blockId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("should update a block successfully", async () => {
      const dto: UpdateBlockDto = {
        name: "Updated Block",
        parentUuid: "some-parent-uuid",
      };
      mockPrismaService.block.findFirst.mockResolvedValue({
        uuid: blockId,
        isRootBlock: false,
      });
      mockPrismaService.block.update.mockResolvedValue(
        Object.assign({ uuid: blockId }, dto),
      );

      const result = await blocksController.update(
        eventId,
        attributeId,
        blockId,
        dto,
      );

      expect(result).toHaveProperty("uuid", blockId);
      expect(result).toHaveProperty("name", "Updated Block");
    });
  });

  describe("remove", () => {
    it("should remove a block successfully", async () => {
      mockPrismaService.block.findFirst.mockResolvedValue({
        uuid: blockId,
        isRootBlock: false,
      });
      mockPrismaService.block.delete.mockResolvedValue({ uuid: blockId });

      await blocksController.remove(eventId, attributeId, blockId);

      expect(mockPrismaService.block.delete).toHaveBeenCalledWith({
        where: { uuid: blockId },
      });
    });
  });

  describe("getBlockTree", () => {
    const eventSlug = "sample-event";
    const eventUuid = "event-uuid";

    const rootBlock = {
      uuid: "root-block",
      name: "Root",
      parentUuid: null,
      attributeUuid: "attr-uuid",
      isRootBlock: true,
      capacity: null,
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const childBlock = {
      uuid: "child-block",
      name: "Child",
      parentUuid: "root-block",
      attributeUuid: "attr-uuid",
      isRootBlock: false,
      capacity: 10,
      order: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const nestedBlock = {
      uuid: "nested-block",
      name: "Nested",
      parentUuid: "child-block",
      attributeUuid: "attr-uuid",
      isRootBlock: false,
      capacity: 5,
      order: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should return block tree with participant counts", async () => {
      mockPrismaService.event.findUnique.mockResolvedValue({
        uuid: eventUuid,
        slug: eventSlug,
      });

      mockPrismaService.block.findMany.mockResolvedValue([
        rootBlock,
        childBlock,
        nestedBlock,
      ]);

      jest
        .spyOn(blocksService, "getBlockParticipantsCount")
        .mockImplementation(async (blockUuid: string) => {
          if (blockUuid === "child-block") {
            return await new Promise((resolve) => {
              resolve(3);
            });
          }
          if (blockUuid === "nested-block") {
            return await new Promise((resolve) => {
              resolve(1);
            });
          }
          return await new Promise((resolve) => {
            resolve(0);
          });
        });

      const result = await blocksPublicController.getBlockTree(
        eventSlug,
        "attr-uuid",
      );

      expect(mockPrismaService.event.findUnique).toHaveBeenCalledWith({
        where: { slug: eventSlug },
      });

      expect(mockPrismaService.block.findMany).toHaveBeenCalledWith({
        where: {
          attributeUuid: "attr-uuid",
          attribute: {
            eventUuid,
          },
        },
      });

      expect(result).toMatchObject({
        uuid: "root-block",
        children: [
          {
            uuid: "child-block",
            blockParticipantCount: 3,
            children: [
              {
                uuid: "nested-block",
                blockParticipantCount: 1,
                children: [],
              },
            ],
          },
        ],
      });
    });

    it("should throw when root block does not exist", async () => {
      mockPrismaService.event.findUnique.mockResolvedValue({
        uuid: eventUuid,
        slug: eventSlug,
      });

      mockPrismaService.block.findMany.mockResolvedValue([
        {
          ...childBlock,
          isRootBlock: false,
        },
      ]);

      await expect(
        blocksPublicController.getBlockTree(eventSlug, "attr-uuid"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should return root block with empty children array", async () => {
      mockPrismaService.event.findUnique.mockResolvedValue({
        uuid: eventUuid,
        slug: eventSlug,
      });

      mockPrismaService.block.findMany.mockResolvedValue([rootBlock]);

      const result = await blocksPublicController.getBlockTree(
        eventSlug,
        "attr-uuid",
      );

      expect(result).toMatchObject({
        uuid: "root-block",
        children: [],
      });
    });

    it("should not calculate participant count for blocks without capacity", async () => {
      mockPrismaService.event.findUnique.mockResolvedValue({
        uuid: eventUuid,
        slug: eventSlug,
      });

      mockPrismaService.block.findMany.mockResolvedValue([rootBlock]);

      const countSpy = jest.spyOn(blocksService, "getBlockParticipantsCount");

      await blocksService.getBlockTree(eventSlug, "attr-uuid");

      expect(countSpy).not.toHaveBeenCalled();
    });
  });
});
