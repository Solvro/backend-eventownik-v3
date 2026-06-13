/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { BlocksService } from "src/blocks/blocks.service";
import { AttributeType } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import { BadRequestException } from "@nestjs/common";
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
});
