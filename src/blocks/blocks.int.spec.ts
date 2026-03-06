import { PrismaService } from "src/prisma/prisma.service";

import { NotFoundException } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { BlocksController } from "./blocks.controller";
import { BlocksService } from "./blocks.service";
import { BlockListingDto } from "./dto/block-listing.dto";
import type { CreateBlockDto } from "./dto/create-block.dto";
import type { UpdateBlockDto } from "./dto/update-block.dto";

describe("Blocks Integration", () => {
  let blocksController: BlocksController;

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
    attribute: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const eventId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
  const attributeId = "3fa85f64-5717-4562-b3fc-2c963f66afa7";
  const blockId = "3fa85f64-5717-4562-b3fc-2c963f66afa8";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlocksService,
        BlocksController,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    blocksController = module.get<BlocksController>(BlocksController);

    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a block successfully", async () => {
      const dto: CreateBlockDto = { name: "Test Block", capacity: 100 };

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
      const dto: CreateBlockDto = { name: "Test Block" };

      await expect(
        blocksController.create(eventId, attributeId, dto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("findAll", () => {
    it("should return a paginated list of blocks", async () => {
      const dto = new BlockListingDto();

      mockPrismaService.attribute.findFirst.mockResolvedValue({
        uuid: attributeId,
        eventUuid: eventId,
      });
      mockPrismaService.$transaction.mockResolvedValue([
        1, // count
        [{ uuid: blockId, name: "Test Block", attributeUuid: attributeId }], // items
      ]);

      const result = await blocksController.findAll(eventId, attributeId, dto);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty("uuid", blockId);
      expect(result.meta.itemCount).toBe(1);
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
      const dto: UpdateBlockDto = { name: "Updated Block" };
      mockPrismaService.block.findFirst.mockResolvedValue({ uuid: blockId });
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
      mockPrismaService.block.findFirst.mockResolvedValue({ uuid: blockId });
      mockPrismaService.block.delete.mockResolvedValue({ uuid: blockId });

      await blocksController.remove(eventId, attributeId, blockId);

      expect(mockPrismaService.block.delete).toHaveBeenCalledWith({
        where: { uuid: blockId },
      });
    });
  });
});
