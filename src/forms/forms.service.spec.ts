import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";
import type { CreateFormDto } from "./dto/create-form.dto";
import { FormListingDto } from "./dto/form-listing.dto";
import { FormsService } from "./forms.service";

describe("FormsService", () => {
  let service: FormsService;
  const mockPrismaService = {
    form: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
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
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FormsService, PrismaService],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    service = module.get<FormsService>(FormsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
  it("should create a form", async () => {
    const eventUuid = "event-uuid-123";
    const dto: CreateFormDto = {
      name: "Test Form",
      isEditable: true,
      openDate: new Date(Date.now() - 1000),
      closeDate: new Date(Date.now() + 1000),
      description: "A test form",
      isFirstForm: true,
      attributes: [
        { attributeUuid: "attr-uuid-1", isRequired: true, order: 1 },
        { attributeUuid: "attr-uuid-2", isRequired: false, order: 2 },
      ],
    };
    const mockForm = {
      uuid: "form-uuid-123",
      name: dto.name,
      isEditable: dto.isEditable,
      openDate: dto.openDate,
      closeDate: dto.closeDate,
      description: dto.description,
      eventUuid,
    };
    mockPrismaService.form.create.mockResolvedValue(mockForm);
    mockPrismaService.attribute.count.mockResolvedValue(2);
    mockPrismaService.event.findUnique.mockResolvedValue({
      uuid: eventUuid,
      registerFormUuid: null,
    });
    mockPrismaService.formDefinition.createMany.mockResolvedValue(
      dto.attributes,
    );
    mockPrismaService.event.update.mockResolvedValue({
      uuid: eventUuid,
      registerFormUuid: mockForm.uuid,
    });
    mockPrismaService.$transaction.mockImplementation((callback) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      return callback(mockPrismaService);
    });
    const createdForm = await service.create(eventUuid, dto);
    expect(createdForm).toEqual(mockForm);
    expect(mockPrismaService.form.create).toHaveBeenCalledWith({
      data: {
        name: dto.name,
        isEditable: dto.isEditable,
        openDate: dto.openDate,
        closeDate: dto.closeDate,
        description: dto.description,
        eventUuid,
      },
    });
    expect(mockPrismaService.attribute.count).toHaveBeenCalledTimes(1);
    expect(mockPrismaService.formDefinition.createMany).toHaveBeenCalledWith({
      data: [
        {
          formUuid: mockForm.uuid,
          attributeUuid: "attr-uuid-1",
          isRequired: true,
          order: 1,
        },
        {
          formUuid: mockForm.uuid,
          attributeUuid: "attr-uuid-2",
          isRequired: false,
          order: 2,
        },
      ],
    });
  });

  it("should throw NotFoundException if event not found when creating form", async () => {
    const eventUuid = "non-existent-event-uuid";
    const dto: CreateFormDto = {
      name: "Test Form",
      isEditable: true,
      openDate: new Date(Date.now() - 1000),
      closeDate: new Date(Date.now() + 1000),
      description: "A test form",
      attributes: [],
    };
    mockPrismaService.event.findUnique.mockResolvedValue(null);
    await expect(service.create(eventUuid, dto)).rejects.toThrow(
      `Event with id: ${eventUuid} not found`,
    );
  });

  it("should return forms with given eventUuid", async () => {
    const eventUuid = "event-uuid-123";
    const mockForms = [
      { eventUuid, name: "Form 1" },
      { eventUuid, name: "Form 2" },
    ];

    mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventUuid });
    mockPrismaService.$transaction.mockResolvedValue([
      mockForms.length,
      mockForms,
    ]);

    const query = new FormListingDto();

    const result = await service.findAll(eventUuid, query);

    expect(result.data).toEqual(mockForms);
    expect(result.meta.itemCount).toBe(mockForms.length);

    expect(mockPrismaService.$transaction).toHaveBeenCalled();
  });

  it("should throw NotFoundException if event not found when fetching forms", async () => {
    const eventUuid = "non-existent-event-uuid";
    const query = new FormListingDto();
    mockPrismaService.event.findUnique.mockResolvedValue(null);
    await expect(service.findAll(eventUuid, query)).rejects.toThrow(
      `Event with id: ${eventUuid} not found`,
    );
  });

  it("should return form by uuid", async () => {
    const formUuid = "form-uuid-123";
    const eventUuid = "event-uuid-123";
    const mockForm = { uuid: formUuid, name: "Form 1" };
    mockPrismaService.form.findUnique.mockResolvedValue(mockForm);
    const form = await service.findOne(formUuid, eventUuid);
    expect(form).toEqual(mockForm);
    expect(mockPrismaService.form.findUnique).toHaveBeenCalledWith({
      where: { uuid: formUuid, eventUuid },
      include: {
        formDefinitions: {
          include: { attribute: true },
        },
      },
    });
  });
  it("should throw NotFoundException if form not found by uuid", async () => {
    const formUuid = "non-existent-form-uuid";
    const eventUuid = "event-uuid-123";
    mockPrismaService.form.findUnique.mockResolvedValue(null);
    await expect(service.findOne(formUuid, eventUuid)).rejects.toThrow(
      `Form with id: ${formUuid} not found`,
    );
    expect(mockPrismaService.form.findUnique).toHaveBeenCalledWith({
      where: { uuid: formUuid, eventUuid },
      include: {
        formDefinitions: {
          include: { attribute: true },
        },
      },
    });
  });

  it("should update a form", async () => {
    const formUuid = "form-uuid-123";
    const eventUuid = "event-uuid-123";
    const updateFormDto = {
      name: "Updated Form",
      isEditable: false,
      openDate: new Date(Date.now() - 1000),
      closeDate: new Date(Date.now() + 1000),
      description: "An updated test form",
      isFirstForm: true,
    };
    const mockForm = {
      uuid: formUuid,
      name: updateFormDto.name,
      isEditable: updateFormDto.isEditable,
      openDate: updateFormDto.openDate,
      closeDate: updateFormDto.closeDate,
      description: updateFormDto.description,
      eventUuid,
    };
    mockPrismaService.event.findUnique.mockResolvedValue({
      uuid: eventUuid,
      registerFormUuid: null,
    });
    mockPrismaService.form.update.mockResolvedValue(mockForm);
    mockPrismaService.$transaction.mockImplementation((callback) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      return callback(mockPrismaService);
    });
    const updatedForm = await service.update(
      formUuid,
      eventUuid,
      updateFormDto,
    );
    expect(updatedForm).toEqual(mockForm);
    expect(mockPrismaService.form.update).toHaveBeenCalledWith({
      where: { uuid: formUuid },
      data: {
        name: updateFormDto.name,
        isEditable: updateFormDto.isEditable,
        openDate: updateFormDto.openDate,
        closeDate: updateFormDto.closeDate,
        description: updateFormDto.description,
      },
      include: {
        formDefinitions: {
          include: { attribute: true },
        },
      },
    });
  });

  it("should throw NotFoundException if event not found when updating form", async () => {
    const formUuid = "form-uuid-123";
    const eventUuid = "non-existent-event-uuid";
    const updateFormDto = {
      name: "Updated Form",
      isEditable: false,
      openDate: new Date(Date.now() - 1000),
      closeDate: new Date(Date.now() + 1000),
      description: "An updated test form",
    };
    mockPrismaService.event.findUnique.mockResolvedValue(null);
    await expect(
      service.update(formUuid, eventUuid, updateFormDto),
    ).rejects.toThrow(`Event with id: ${eventUuid} not found`);
  });

  it("should delete a form", async () => {
    const formUuid = "form-uuid-123";
    const eventUuid = "event-uuid-123";
    const mockForm = {
      uuid: formUuid,
      name: "Form to be deleted",
      eventUuid,
    };
    mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventUuid });
    mockPrismaService.form.findUnique.mockResolvedValue(mockForm);
    mockPrismaService.form.deleteMany.mockResolvedValue({ mockForm });
    const deletedForm = await service.remove(formUuid, eventUuid);
    expect(deletedForm).toEqual({ mockForm });
    expect(mockPrismaService.form.deleteMany).toHaveBeenCalledWith({
      where: { uuid: formUuid, eventUuid },
    });
  });

  it("should throw NotFoundException if form not found when deleting", async () => {
    const formUuid = "non-existent-form-uuid";
    const eventUuid = "event-uuid-123";
    mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventUuid });
    mockPrismaService.form.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.remove(formUuid, eventUuid)).rejects.toThrow(
      `Form with id: ${formUuid} not found`,
    );
  });
});
