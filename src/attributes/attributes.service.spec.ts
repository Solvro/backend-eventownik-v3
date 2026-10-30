/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { BlocksService } from "src/blocks/blocks.service";
import { AttributeType } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import { BadRequestException, ConflictException } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { AttributesService } from "./attributes.service";

describe("AttributesService", () => {
  let service: AttributesService;

  const mockPrismaService = {
    attribute: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
    },
    block: {
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
    },
    ticket: {
      findUnique: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockBlocksService = {
    ensureRootBlock: jest.fn(),
    deleteRootBlocks: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttributesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: BlocksService, useValue: mockBlocksService },
      ],
    }).compile();

    service = module.get<AttributesService>(AttributesService);
  });

  it("should default block maxSelections to 1 on create", async () => {
    const eventId = "event-uuid";
    const attributeUuid = "attribute-uuid";

    mockPrismaService.$transaction.mockImplementation(async (callback) => {
      return await callback(mockPrismaService);
    });
    mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventId });
    mockPrismaService.attribute.create.mockResolvedValue({
      uuid: attributeUuid,
      name: "Block attribute",
      order: 1,
      showInList: true,
      type: AttributeType.block,
      eventUuid: eventId,
      config: { maxSelections: 1 },
    });

    const result = await service.create(
      {
        name: "Block attribute",
        order: 1,
        showInList: true,
        type: AttributeType.block,
      },
      eventId,
    );

    expect(result).toEqual({
      uuid: attributeUuid,
      name: "Block attribute",
      order: 1,
      showInList: true,
      type: AttributeType.block,
      eventUuid: eventId,
      config: { maxSelections: 1 },
    });
    expect(mockPrismaService.attribute.create).toHaveBeenCalledWith({
      data: {
        name: "Block attribute",
        order: 1,
        showInList: true,
        type: AttributeType.block,
        eventUuid: eventId,
        config: { maxSelections: 1 },
      },
    });
  });

  it("should reject select attributes without options", async () => {
    const eventId = "event-uuid";

    mockPrismaService.$transaction.mockImplementation(async (callback) => {
      return await callback(mockPrismaService);
    });
    mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventId });

    await expect(
      service.create(
        {
          name: "Select attribute",
          order: 1,
          showInList: true,
          type: AttributeType.select,
          config: {},
        },
        eventId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("should normalize block config on update", async () => {
    const eventId = "event-uuid";
    const attributeUuid = "attribute-uuid";

    mockPrismaService.$transaction.mockImplementation(async (callback) => {
      return await callback(mockPrismaService);
    });
    mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventId });
    mockPrismaService.attribute.findFirst.mockResolvedValue({
      uuid: attributeUuid,
      name: "Text attribute",
      order: 1,
      showInList: true,
      type: AttributeType.text,
      eventUuid: eventId,
    });
    mockPrismaService.attribute.update.mockResolvedValue({
      uuid: attributeUuid,
      name: "Block attribute",
      order: 2,
      showInList: false,
      type: AttributeType.block,
      eventUuid: eventId,
      config: { maxSelections: 1 },
    });

    await service.update(attributeUuid, eventId, {
      name: "Block attribute",
      order: 2,
      showInList: false,
      type: AttributeType.block,
    });

    expect(mockPrismaService.attribute.update).toHaveBeenCalledWith({
      where: { uuid: attributeUuid, eventUuid: eventId },
      data: {
        name: "Block attribute",
        order: 2,
        showInList: false,
        type: AttributeType.block,
        config: { maxSelections: 1 },
      },
    });
  });

  it("should allow email in block participantFields", async () => {
    const eventId = "event-uuid";

    mockPrismaService.$transaction.mockImplementation(async (callback) => {
      return await callback(mockPrismaService);
    });
    mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventId });
    mockPrismaService.attribute.create.mockResolvedValue({
      uuid: "attribute-uuid",
      name: "Block attribute",
      order: 1,
      showInList: true,
      type: AttributeType.block,
      eventUuid: eventId,
      config: {
        maxSelections: 1,
        participantFields: ["550e8400-e29b-41d4-a716-446655440000", "email"],
      },
    });

    await service.create(
      {
        name: "Block attribute",
        order: 1,
        showInList: true,
        type: AttributeType.block,
        config: {
          participantFields: ["550e8400-e29b-41d4-a716-446655440000", "email"],
        },
      },
      eventId,
    );

    expect(mockPrismaService.attribute.create).toHaveBeenCalledWith({
      data: {
        name: "Block attribute",
        order: 1,
        showInList: true,
        type: AttributeType.block,
        eventUuid: eventId,
        config: {
          maxSelections: 1,
          participantFields: ["550e8400-e29b-41d4-a716-446655440000", "email"],
        },
      },
    });
  });
  describe("changing the type of a block attribute used by a ticket", () => {
    const eventId = "event-uuid";
    const attributeUuid = "attribute-uuid";

    const blockAttribute = {
      uuid: attributeUuid,
      name: "Workshops",
      order: 1,
      showInList: true,
      type: AttributeType.block,
      eventUuid: eventId,
      config: { maxSelections: 1 },
    };

    beforeEach(() => {
      jest.resetAllMocks();
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrismaService);
      });
      mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventId });
      mockPrismaService.attribute.findFirst.mockResolvedValue(blockAttribute);
    });

    it("update throws ConflictException and changes nothing", async () => {
      mockPrismaService.ticket.findUnique.mockResolvedValue({
        uuid: "ticket-uuid",
      });

      await expect(
        service.update(attributeUuid, eventId, { type: AttributeType.text }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrismaService.attribute.update).not.toHaveBeenCalled();
      expect(mockBlocksService.deleteRootBlocks).not.toHaveBeenCalled();
    });

    it("bulkUpdate throws ConflictException and changes nothing", async () => {
      mockPrismaService.ticket.findUnique.mockResolvedValue({
        uuid: "ticket-uuid",
      });

      await expect(
        service.bulkUpdate(eventId, [
          { uuid: attributeUuid, type: AttributeType.text },
        ]),
      ).rejects.toThrow(ConflictException);

      expect(mockPrismaService.attribute.update).not.toHaveBeenCalled();
    });

    it("allows the type change when no ticket uses the attribute", async () => {
      mockPrismaService.ticket.findUnique.mockResolvedValue(null);
      mockPrismaService.attribute.update.mockResolvedValue({
        ...blockAttribute,
        type: AttributeType.text,
      });

      await service.update(attributeUuid, eventId, {
        type: AttributeType.text,
      });

      expect(mockBlocksService.deleteRootBlocks).toHaveBeenCalledWith(
        attributeUuid,
        mockPrismaService,
      );
    });

    it("does not look for a ticket when the type stays block", async () => {
      mockPrismaService.attribute.update.mockResolvedValue(blockAttribute);

      await service.update(attributeUuid, eventId, { name: "Renamed" });

      expect(mockPrismaService.ticket.findUnique).not.toHaveBeenCalled();
    });
  });
});
