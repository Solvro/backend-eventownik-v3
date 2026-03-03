/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { AttributeType } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import { NotFoundException } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { AttributesController } from "./attributes.controller";
import { AttributesService } from "./attributes.service";
import { AttributeListingDto } from "./dto/attribute-listing.dto";
import type { CreateAttributeDto } from "./dto/create-attribute.dto";
import type { UpdateAttributeDto } from "./dto/update-attribute.dto";

describe("Attributes Integration", () => {
  let attributeController: AttributesController;

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
    event: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttributesController],
      providers: [
        AttributesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    attributeController =
      module.get<AttributesController>(AttributesController);
  });

  it("should be defined", () => {
    expect(attributeController).toBeDefined();
  });

  it("should create an attribute", async () => {
    const dto: CreateAttributeDto = {
      name: "Test Attribute",
      options: ["Option 1", "Option 2"],
      order: 1,
      showInList: true,
      type: AttributeType.block,
    };
    const eventId = "test-event-id";
    mockPrismaService.$transaction.mockImplementation(async (callback) => {
      return await callback(mockPrismaService);
    });
    mockPrismaService.event.findUnique.mockResolvedValue({
      uuid: eventId,
      attributes: [],
    });
    mockPrismaService.attribute.create.mockResolvedValue({
      id: 1,
      name: dto.name,
      options: dto.options,
      order: dto.order,
      showInList: dto.showInList,
      type: dto.type,
      eventUuid: eventId,
    });
    const result = await attributeController.create(dto, eventId);
    expect(result).toEqual({
      id: 1,
      name: dto.name,
      options: dto.options,
      order: dto.order,
      showInList: dto.showInList,
      type: dto.type,
      eventUuid: eventId,
    });
    expect(mockPrismaService.event.findUnique).toHaveBeenCalledWith({
      where: { uuid: eventId },
    });
    expect(mockPrismaService.attribute.create).toHaveBeenCalledWith({
      data: {
        name: dto.name,
        options: dto.options,
        order: dto.order,
        showInList: dto.showInList,
        type: dto.type,
        eventUuid: eventId,
      },
    });
  });

  it("should throw NotFoundException if event is not found when creating an attribute", async () => {
    const dto: CreateAttributeDto = {
      name: "Test Attribute",
      options: ["Option 1", "Option 2"],
      order: 1,
      showInList: true,
      type: AttributeType.block,
    };
    const eventId = "non-existent-event-id";
    mockPrismaService.$transaction.mockImplementation(async (callback) => {
      return await callback(mockPrismaService);
    });
    mockPrismaService.event.findUnique.mockResolvedValue(null);
    await expect(attributeController.create(dto, eventId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("should find a list of attributes for an event", async () => {
    const eventId = "test-event-id";
    const mockAttributes = [
      {
        uuid: "test-attribute-id-1",
        name: "Test Attribute 1",
        options: ["Option 1", "Option 2"],
        order: 1,
        showInList: true,
        type: AttributeType.block,
        eventUuid: eventId,
      },
      {
        uuid: "test-attribute-id-2",
        name: "Test Attribute 2",
        options: ["Option A", "Option B"],
        order: 2,
        showInList: false,
        type: AttributeType.text,
        eventUuid: eventId,
      },
    ];
    mockPrismaService.event.findUnique.mockResolvedValue({
      uuid: eventId,
      attributes: mockAttributes,
    });
    const query = new AttributeListingDto();
    mockPrismaService.$transaction.mockResolvedValue([
      mockAttributes.length,
      mockAttributes,
    ]);
    const result = await attributeController.findAll(eventId, query);
    expect(result.meta.itemCount).toBe(mockAttributes.length);
    expect(result.data).toEqual(mockAttributes);
    expect(mockPrismaService.event.findUnique).toHaveBeenCalledWith({
      where: { uuid: eventId },
    });
  });

  it("should find an attribute by id", async () => {
    const eventId = "test-event-id";
    const attributeId = "test-attribute-id";
    const mockAttribute = {
      uuid: attributeId,
      name: "Test Attribute",
      options: ["Option 1", "Option 2"],
      order: 1,
      showInList: true,
      type: AttributeType.block,
      eventUuid: eventId,
    };
    mockPrismaService.event.findUnique.mockResolvedValue({
      uuid: eventId,
    });
    mockPrismaService.attribute.findFirst.mockResolvedValue(mockAttribute);
    const result = await attributeController.findOne(attributeId, eventId);
    expect(result).toEqual(mockAttribute);
    expect(mockPrismaService.event.findUnique).toHaveBeenCalledWith({
      where: { uuid: eventId },
    });
  });

  it("should throw NotFoundException if event is not found when finding an attribute", async () => {
    const eventId = "non-existent-event-id";
    const attributeId = "test-attribute-id";
    mockPrismaService.event.findUnique.mockResolvedValue(null);
    await expect(
      attributeController.findOne(attributeId, eventId),
    ).rejects.toThrow(NotFoundException);
  });

  it("should update an attribute", async () => {
    const eventId = "test-event-id";
    const attributeId = "test-attribute-id";
    const dto: UpdateAttributeDto = {
      name: "Updated Test Attribute",
      options: ["Updated Option 1", "Updated Option 2"],
      order: 2,
      showInList: false,
      type: AttributeType.text,
    };
    mockPrismaService.$transaction.mockImplementation(async (callback) => {
      return await callback(mockPrismaService);
    });

    mockPrismaService.event.findUnique.mockResolvedValue({
      uuid: eventId,
    });
    mockPrismaService.attribute.findFirst.mockResolvedValue({
      uuid: attributeId,
      name: "Test Attribute",
      options: ["Option 1", "Option 2"],
      order: 1,
      showInList: true,
      type: AttributeType.block,
      eventUuid: eventId,
    });
    mockPrismaService.attribute.update.mockResolvedValue({
      uuid: attributeId,
      name: dto.name,
      options: dto.options,
      order: dto.order,
      showInList: dto.showInList,
      type: dto.type,
      eventUuid: eventId,
    });
    const result = await attributeController.update(attributeId, eventId, dto);

    expect(result).toEqual({
      uuid: attributeId,
      name: dto.name,
      options: dto.options,
      order: dto.order,
      showInList: dto.showInList,
      type: dto.type,
      eventUuid: eventId,
    });
  });
  it("should delete an attribute", async () => {
    const eventId = "test-event-id";
    const attributeId = "test-attribute-id";
    const mockAttribute = {
      uuid: attributeId,
      name: "Test Attribute",
      options: ["Option 1", "Option 2"],
      order: 1,
      showInList: true,
      type: AttributeType.block,
      eventUuid: eventId,
    };
    mockPrismaService.$transaction.mockImplementation(async (callback) => {
      return await callback(mockPrismaService);
    });
    mockPrismaService.event.findUnique.mockResolvedValue({
      uuid: eventId,
    });
    mockPrismaService.attribute.deleteMany.mockResolvedValue(mockAttribute);
    const result = await attributeController.remove(attributeId, eventId);
    expect(result).toEqual({
      uuid: attributeId,
      name: "Test Attribute",
      options: ["Option 1", "Option 2"],
      order: 1,
      showInList: true,
      type: AttributeType.block,
      eventUuid: eventId,
    });
    expect(mockPrismaService.attribute.deleteMany).toHaveBeenCalledWith({
      where: { uuid: attributeId, eventUuid: eventId },
    });
  });
});
