/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import type { Attribute } from "src/generated/prisma/client";
import { AttributeType } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { AttributesController } from "./attributes.controller";
import { AttributesService } from "./attributes.service";
import type { CreateAttributeDto } from "./dto/create-attribute.dto";
import type { UpdateAttributeDto } from "./dto/update-attribute.dto";

describe("AttributesService", () => {
  let attributeController: AttributesController;

  const mockPrismaService = {
    attribute: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
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
      include: { attributes: true },
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
      "Event not found",
    );
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
      attributes: [mockAttribute],
    });
    const result = await attributeController.findOne(attributeId, eventId);
    expect(result).toEqual(mockAttribute);
    expect(mockPrismaService.event.findUnique).toHaveBeenCalledWith({
      where: { uuid: eventId },
      include: { attributes: true },
    });
  });

  it("should throw NotFoundException if event is not found when finding an attribute", async () => {
    const eventId = "non-existent-event-id";
    const attributeId = "test-attribute-id";
    mockPrismaService.event.findUnique.mockResolvedValue(null);
    await expect(
      attributeController.findOne(attributeId, eventId),
    ).rejects.toThrow("Event not found");
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
      attributes: [
        {
          uuid: attributeId,
          name: dto.name,
          options: dto.options,
          order: dto.order,
          showInList: dto.showInList,
          type: dto.type,
          eventUuid: eventId,
        },
      ],
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
    mockPrismaService.$transaction.mockImplementation(async (callback) => {
      return await callback(mockPrismaService);
    });
    mockPrismaService.event.findUnique.mockResolvedValue({
      uuid: eventId,
      attributes: [
        {
          uuid: attributeId,
          name: "Test Attribute",
          options: ["Option 1", "Option 2"],
          order: 1,
          showInList: true,
          type: AttributeType.block,
          eventUuid: eventId,
        },
      ] as Attribute[],
    });
    mockPrismaService.attribute.delete.mockResolvedValue({
      uuid: attributeId,
      name: "Test Attribute",
      options: ["Option 1", "Option 2"],
      order: 1,
      showInList: true,
      type: AttributeType.block,
      eventUuid: eventId,
    });
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
    expect(mockPrismaService.attribute.delete).toHaveBeenCalledWith({
      where: { uuid: attributeId },
    });
  });
});
