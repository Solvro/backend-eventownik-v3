import { PrismaService } from "src/prisma/prisma.service";

import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { FormListingDto } from "./dto/form-listing.dto";
import { FormsController } from "./forms.controller";
import { FormsService } from "./forms.service";

describe("Forms Integration", () => {
  let formsController: FormsController;

  const mockPrismaService = {
    form: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    attribute: {
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    formDefinition: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormsService,
        FormsController,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();
    formsController = module.get<FormsController>(FormsController);
  });

  it("should be defined", () => {
    expect(formsController).toBeDefined();
  });
  it("should create a form", async () => {
    const dto = {
      name: "Integration Test Form",
      isEditable: true,
      openDate: new Date(Date.now() - 1000),
      closeDate: new Date(Date.now() + 1000),
      description: "An integration test form",
      isFirstForm: false,
      attributes: [
        { attributeUuid: "attr-uuid-1", isRequired: true, order: 1 },
        { attributeUuid: "attr-uuid-2", isRequired: false, order: 2 },
      ],
    };
    mockPrismaService.$transaction.mockImplementation((callback) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      callback(mockPrismaService),
    );
    mockPrismaService.form.create.mockResolvedValue({
      uuid: "form-uuid-123",
      name: dto.name,
      isEditable: dto.isEditable,
      openDate: dto.openDate,
      closeDate: dto.closeDate,
      description: dto.description,
    });
    mockPrismaService.event.findUnique.mockResolvedValue({
      uuid: "event-uuid-123",
    });
    mockPrismaService.attribute.count.mockResolvedValue(2);
    mockPrismaService.formDefinition.createMany.mockResolvedValue({});

    mockPrismaService.formDefinition.createMany.mockResolvedValue({});
    const result = await formsController.create("event-uuid-123", dto);
    expect(result).toBeDefined();
    expect(result).toMatchObject({
      name: dto.name,
      isEditable: dto.isEditable,
      openDate: dto.openDate,
      closeDate: dto.closeDate,
      description: dto.description,
    });
  });

  it("should not create a form with invalid attribute", async () => {
    const dto = {
      name: "Integration Test Form",
      isEditable: true,
      openDate: new Date(),
      closeDate: new Date(),
      description: "An integration test form",
      isFirstForm: false,
      attributes: [
        { attributeUuid: "invalid-attr-uuid", isRequired: true, order: 1 },
      ],
    };
    mockPrismaService.$transaction.mockImplementation((callback) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      callback(mockPrismaService),
    );
    mockPrismaService.event.findUnique.mockResolvedValue({
      uuid: "event-uuid-123",
    });
    mockPrismaService.attribute.findFirst.mockResolvedValue(null);
    await expect(
      formsController.create("event-uuid-123", dto),
    ).rejects.toThrow();
  });

  it("should not create a form for second first form", async () => {
    const dto = {
      name: "Integration Test Form",
      isEditable: true,
      openDate: new Date(),
      closeDate: new Date(),
      description: "An integration test form",
      isFirstForm: true,
      attributes: [
        { attributeUuid: "attr-uuid-1", isRequired: true, order: 1 },
      ],
    };
    mockPrismaService.$transaction.mockImplementation((callback) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      callback(mockPrismaService),
    );
    mockPrismaService.event.findUnique.mockResolvedValue({
      uuid: "event-uuid-123",
      registerFormUuid: "some-existing-form-uuid",
    });
    await expect(
      formsController.create("event-uuid-123", dto),
    ).rejects.toThrow();
  });

  it("should get all forms for an event", async () => {
    const eventUuid = "event-uuid-123";
    const mockForms = [
      {
        uuid: "form-uuid-1",
        name: "Form 1",
        openDate: new Date(),
        closeDate: new Date(),
        description: "First form",
      },
      {
        uuid: "form-uuid-2",
        name: "Form 2",
        openDate: new Date(),
        closeDate: new Date(),
        description: "Second form",
      },
    ];
    const query = new FormListingDto();
    mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventUuid });
    mockPrismaService.$transaction.mockResolvedValue([
      mockForms.length,
      mockForms,
    ]);
    const result = await formsController.findAll(eventUuid, query);
    expect(result.data).toEqual(mockForms);
    expect(result.meta.itemCount).toBe(mockForms.length);

    expect(mockPrismaService.$transaction).toHaveBeenCalled();
  });

  it("should get a form by id for an event", async () => {
    const mockForm = {
      uuid: "form-uuid-1",
      name: "Form 1",
      openDate: new Date(),
      closeDate: new Date(),
      description: "First form",
    };
    mockPrismaService.form.findUnique.mockResolvedValue(mockForm);
    const result = await formsController.findOne(
      "event-uuid-123",
      "form-uuid-1",
    );
    expect(result).toEqual(mockForm);
  });

  it("should throw NotFoundException if form not found by id for an event", async () => {
    mockPrismaService.form.findUnique.mockResolvedValue(null);
    await expect(
      formsController.findOne("event-uuid-123", "non-existent-form-uuid"),
    ).rejects.toThrow();
  });

  it("should update a form for an event", async () => {
    const dto = {
      name: "Updated Form Name",
      isEditable: false,
      openDate: new Date(Date.now() - 1000),
      closeDate: new Date(Date.now() + 1000),
      description: "Updated description",
      isFirstForm: false,
      attributes: [
        { attributeUuid: "attr-uuid-1", isRequired: true, order: 1 },
        { attributeUuid: "attr-uuid-2", isRequired: false, order: 2 },
      ],
    };
    mockPrismaService.$transaction.mockImplementation((callback) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      callback(mockPrismaService),
    );
    mockPrismaService.event.findUnique.mockResolvedValue({
      uuid: "event-uuid-123",
      registerFormUuid: null,
    });
    mockPrismaService.form.update.mockResolvedValue({
      uuid: "form-uuid-1",
      name: dto.name,
      isEditable: dto.isEditable,
      openDate: dto.openDate,
      closeDate: dto.closeDate,
      description: dto.description,
    });
    mockPrismaService.attribute.count.mockResolvedValue(2);
    mockPrismaService.formDefinition.deleteMany.mockResolvedValue({ count: 2 });
    mockPrismaService.formDefinition.createMany.mockResolvedValue({});
    const result = await formsController.update(
      "event-uuid-123",
      "form-uuid-1",
      dto,
    );
    expect(result).toBeDefined();
    expect(result).toMatchObject({
      name: dto.name,
      isEditable: dto.isEditable,
      openDate: dto.openDate,
      closeDate: dto.closeDate,
      description: dto.description,
    });
  });

  it("should delete a form for an event and update the event's registerFormUuid if necessary", async () => {
    mockPrismaService.event.findUnique.mockResolvedValue({
      uuid: "event-uuid-123",
      registerFormUuid: "form-uuid-1",
    });
    mockPrismaService.event.update.mockResolvedValue({
      uuid: "event-uuid-123",
    });
    mockPrismaService.form.deleteMany.mockResolvedValue({ count: 1 });
    mockPrismaService.$transaction.mockImplementation((callback) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      callback(mockPrismaService),
    );
    await formsController.remove("event-uuid-123", "form-uuid-1");
    expect(mockPrismaService.event.update).toHaveBeenCalled();
    expect(mockPrismaService.form.deleteMany).toHaveBeenCalled();
    expect(mockPrismaService.form.deleteMany).toHaveBeenCalledWith({
      where: { uuid: "form-uuid-1", eventUuid: "event-uuid-123" },
    });
  });

  it("should throw NotFoundException when deleting a non-existent form for an event", async () => {
    mockPrismaService.event.findUnique.mockResolvedValue({
      uuid: "event-uuid-123",
      registerFormUuid: null,
    });
    mockPrismaService.form.deleteMany.mockResolvedValue({ count: 0 });
    mockPrismaService.$transaction.mockImplementation((callback) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      callback(mockPrismaService),
    );
    await expect(
      formsController.remove("event-uuid-123", "non-existent-form-uuid"),
    ).rejects.toThrow();
    expect(mockPrismaService.form.deleteMany).toHaveBeenCalledWith({
      where: { uuid: "non-existent-form-uuid", eventUuid: "event-uuid-123" },
    });
  });
});
