import { BlocksService } from "src/blocks/blocks.service";
import { AttributeType } from "src/generated/prisma/client";
import { ParticipantsService } from "src/participants/participants.service";
import { StorageService } from "src/storage/storage.service";

import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";
import type { CreateFormDto } from "./dto/create-form.dto";
import { FormListingDto } from "./dto/form-listing.dto";
import type { FormSubmitionDto } from "./dto/form-submition.dto";
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
    block: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    formDefinition: {
      createMany: jest.fn(),
    },
    uploadedFile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    participantAttribute: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockParticipantsService = {
    update: jest.fn(),
    register: jest.fn(),
  };
  const mockBlocksService = {
    canSignInToBlock: jest.fn(),
  };

  const mockStorageService = {
    upload: jest.fn(),
    delete: jest.fn(),
    getUrl: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn(() => "forms-bucket"),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormsService,
        PrismaService,
        ParticipantsService,
        BlocksService,
        StorageService,
        ConfigService,
        EventEmitter2,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(ParticipantsService)
      .useValue(mockParticipantsService)
      .overrideProvider(BlocksService)
      .useValue(mockBlocksService)
      .overrideProvider(StorageService)
      .useValue(mockStorageService)
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .overrideProvider(EventEmitter2)
      .useValue(mockEventEmitter)
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
      openCondition: "ON_DATE",
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
      isOpen: undefined,
      openCondition: dto.openCondition,
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
        openCondition: dto.openCondition,
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

  it("should return form by uuid with provided event uuid", async () => {
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
  it("should throw NotFoundException if form not found by uuid with provided event uuid", async () => {
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

  it("should return form by uuid with provided event slug", async () => {
    const formUuid = "form-uuid-123";
    const eventSlug = "event";
    const mockForm = { uuid: formUuid, name: "Form 1" };
    mockPrismaService.form.findUnique.mockResolvedValue(mockForm);
    const form = await service.findOneBySlug(formUuid, eventSlug);
    expect(form).toEqual(mockForm);
    expect(mockPrismaService.form.findUnique).toHaveBeenCalledWith({
      where: { uuid: formUuid, event: { slug: eventSlug } },
      include: {
        formDefinitions: {
          include: { attribute: true },
        },
      },
    });
  });
  it("should throw NotFoundException if form not found by uuid with provided event slug", async () => {
    const formUuid = "non-existent-form-uuid";
    const eventSlug = "event";
    mockPrismaService.form.findUnique.mockResolvedValue(null);
    await expect(service.findOneBySlug(formUuid, eventSlug)).rejects.toThrow(
      `Form with id: ${formUuid} not found`,
    );
    expect(mockPrismaService.form.findUnique).toHaveBeenCalledWith({
      where: { uuid: formUuid, event: { slug: eventSlug } },
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
    mockPrismaService.form.findFirst.mockResolvedValue({
      uuid: formUuid,
      eventUuid,
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

  describe("formSubmit", () => {
    const eventSlug = "event";
    const eventUuid = "event-123";
    const formUuid = "form-123";
    const participantId = "part-123";

    beforeEach(() => {
      jest.clearAllMocks();

      mockPrismaService.$transaction.mockImplementation((callback) =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        callback(mockPrismaService),
      );
    });

    it("should throw BadRequestException if form is closed", async () => {
      mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventUuid });
      mockPrismaService.form.findUnique.mockResolvedValue({ uuid: formUuid });

      jest.spyOn(service, "isOpen").mockResolvedValue(false);

      await expect(
        service.formSubmit(eventSlug, formUuid, {
          attributes: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    // Select/multiSelect/block value validation (options membership,
    // maxSelections, block existence) no longer happens in forms.service —
    // it's the canonical normalizer's job now (see
    // attribute-value-normalizer.spec.ts), which participantService.update/
    // register run internally. Since ParticipantsService is mocked here,
    // these cases assert forms.service forwards the raw submitted value
    // through unchanged rather than validating it itself.
    it("should pass an out-of-options select value through unchanged", async () => {
      const submissionData = {
        email: "test@example.com",
        attributes: [[{ attributeUuid: "attr-select", value: "choice-1" }]],
      } as unknown as FormSubmitionDto;

      mockPrismaService.event.findUnique.mockResolvedValue({
        uuid: eventUuid,
        registerFormUuid: formUuid,
        participants: [],
        participantsLimit: 10,
      });
      mockPrismaService.form.findUnique.mockResolvedValue({
        uuid: formUuid,
        formDefinitions: [
          {
            attributeUuid: "attr-select",
            isRequired: true,
            attribute: {
              uuid: "attr-select",
              type: AttributeType.select,
              config: {
                options: ["choice-2"],
                allowOther: false,
              },
            },
          },
        ],
      });
      jest.spyOn(service, "isOpen").mockResolvedValue(true);
      mockParticipantsService.register.mockResolvedValue({
        id: 1,
        email: submissionData.email,
      });

      await service.formSubmit(eventSlug, formUuid, submissionData);

      expect(mockParticipantsService.register).toHaveBeenCalledWith(
        eventUuid,
        submissionData.email,
        [{ attributeUuid: "attr-select", value: "choice-1" }],
        { trustedFileValues: true },
      );
    });

    it("should pass an out-of-options multiSelect value through unchanged", async () => {
      const submissionData = {
        email: "test@example.com",
        attributes: [[{ attributeUuid: "attr-multi", value: ["invalid"] }]],
      } as unknown as FormSubmitionDto;

      mockPrismaService.event.findUnique.mockResolvedValue({
        uuid: eventUuid,
        registerFormUuid: formUuid,
        participants: [],
        participantsLimit: 10,
      });
      mockPrismaService.form.findUnique.mockResolvedValue({
        uuid: formUuid,
        formDefinitions: [
          {
            attributeUuid: "attr-multi",
            isRequired: true,
            attribute: {
              uuid: "attr-multi",
              type: AttributeType.multiSelect,
              config: {
                options: ["allowed-1", "allowed-2"],
                maxSelections: 2,
              },
            },
          },
        ],
      });
      jest.spyOn(service, "isOpen").mockResolvedValue(true);
      mockParticipantsService.register.mockResolvedValue({
        id: 1,
        email: submissionData.email,
      });

      await service.formSubmit(eventSlug, formUuid, submissionData);

      expect(mockParticipantsService.register).toHaveBeenCalledWith(
        eventUuid,
        submissionData.email,
        [{ attributeUuid: "attr-multi", value: ["invalid"] }],
        { trustedFileValues: true },
      );
    });

    it("should pass a multiSelect value exceeding maxSelections through unchanged", async () => {
      const submissionData = {
        email: "test@example.com",
        attributes: [
          [
            {
              attributeUuid: "attr-multi",
              value: ["allowed-1", "allowed-2", "allowed-3"],
            },
          ],
        ],
      } as unknown as FormSubmitionDto;

      mockPrismaService.event.findUnique.mockResolvedValue({
        uuid: eventUuid,
        registerFormUuid: formUuid,
        participants: [],
        participantsLimit: 10,
      });
      mockPrismaService.form.findUnique.mockResolvedValue({
        uuid: formUuid,
        formDefinitions: [
          {
            attributeUuid: "attr-multi",
            isRequired: true,
            attribute: {
              uuid: "attr-multi",
              type: AttributeType.multiSelect,
              config: {
                options: ["allowed-1", "allowed-2", "allowed-3"],
                maxSelections: 2,
              },
            },
          },
        ],
      });
      jest.spyOn(service, "isOpen").mockResolvedValue(true);
      mockParticipantsService.register.mockResolvedValue({
        id: 1,
        email: submissionData.email,
      });

      await service.formSubmit(eventSlug, formUuid, submissionData);

      expect(mockParticipantsService.register).toHaveBeenCalledWith(
        eventUuid,
        submissionData.email,
        [
          {
            attributeUuid: "attr-multi",
            value: ["allowed-1", "allowed-2", "allowed-3"],
          },
        ],
        { trustedFileValues: true },
      );
    });

    it("should validate block submissions and save successfully", async () => {
      const submissionData = {
        email: "test@example.com",
        attributes: [
          [
            {
              attributeUuid: "attr-block",
              value: [
                "550e8400-e29b-41d4-a716-446655440000",
                "550e8400-e29b-41d4-a716-446655440001",
              ],
            },
          ],
        ],
      } as unknown as FormSubmitionDto;

      mockPrismaService.event.findUnique.mockResolvedValue({
        uuid: eventUuid,
        registerFormUuid: formUuid,
        participants: [],
        participantsLimit: 10,
      });
      mockPrismaService.form.findUnique.mockResolvedValue({
        uuid: formUuid,
        formDefinitions: [
          {
            attributeUuid: "attr-block",
            isRequired: true,
            attribute: {
              uuid: "attr-block",
              type: AttributeType.block,
              config: {
                maxSelections: 2,
              },
            },
          },
        ],
      });
      mockBlocksService.canSignInToBlock.mockResolvedValue(true);
      jest.spyOn(service, "isOpen").mockResolvedValue(true);
      mockParticipantsService.register.mockResolvedValue({
        id: 1,
        email: submissionData.email,
      });

      const result = await service.formSubmit(
        eventSlug,
        formUuid,
        submissionData,
      );

      expect(mockParticipantsService.register).toHaveBeenCalledWith(
        eventUuid,
        submissionData.email,
        [
          {
            attributeUuid: "attr-block",
            value: [
              "550e8400-e29b-41d4-a716-446655440000",
              "550e8400-e29b-41d4-a716-446655440001",
            ],
          },
        ],
        { trustedFileValues: true },
      );
      expect(result).toBeDefined();
    });

    it("should pass a block value exceeding maxSelections through unchanged (capacity pre-check still applies)", async () => {
      const submissionData = {
        email: "test@example.com",
        attributes: [
          [
            {
              attributeUuid: "attr-block",
              value: [
                "550e8400-e29b-41d4-a716-446655440000",
                "550e8400-e29b-41d4-a716-446655440001",
                "550e8400-e29b-41d4-a716-446655440002",
              ],
            },
          ],
        ],
      } as unknown as FormSubmitionDto;

      mockPrismaService.event.findUnique.mockResolvedValue({
        uuid: eventUuid,
        registerFormUuid: formUuid,
        participants: [],
        participantsLimit: 10,
      });
      mockPrismaService.form.findUnique.mockResolvedValue({
        uuid: formUuid,
        formDefinitions: [
          {
            attributeUuid: "attr-block",
            isRequired: true,
            attribute: {
              uuid: "attr-block",
              type: AttributeType.block,
              config: {
                maxSelections: 2,
              },
            },
          },
        ],
      });
      jest.spyOn(service, "isOpen").mockResolvedValue(true);
      mockBlocksService.canSignInToBlock.mockResolvedValue(true);
      mockParticipantsService.register.mockResolvedValue({
        id: 1,
        email: submissionData.email,
      });

      await service.formSubmit(eventSlug, formUuid, submissionData);

      expect(mockParticipantsService.register).toHaveBeenCalledWith(
        eventUuid,
        submissionData.email,
        [
          {
            attributeUuid: "attr-block",
            value: [
              "550e8400-e29b-41d4-a716-446655440000",
              "550e8400-e29b-41d4-a716-446655440001",
              "550e8400-e29b-41d4-a716-446655440002",
            ],
          },
        ],
        { trustedFileValues: true },
      );
    });

    it("should register a new participant if it is a registration form", async () => {
      const submissionData = {
        email: "test@example.com",
        attributes: [[{ attributeUuid: "attr-1", value: "value-1" }]],
      } as unknown as FormSubmitionDto;

      mockPrismaService.event.findUnique.mockResolvedValue({
        uuid: eventUuid,
        registerFormUuid: formUuid,
        participants: [],
        participantsLimit: 10,
      });

      mockPrismaService.form.findUnique.mockResolvedValue({
        uuid: formUuid,
        formDefinitions: [
          {
            attributeUuid: "attr-1",
            isRequired: true,
            attribute: { uuid: "attr-1" },
          },
        ],
      });

      jest.spyOn(service, "isOpen").mockResolvedValue(true);
      mockParticipantsService.register.mockResolvedValue({
        id: 1,
        email: submissionData.email,
      });

      const result = await service.formSubmit(
        eventSlug,
        formUuid,
        submissionData,
      );

      expect(mockParticipantsService.register).toHaveBeenCalledWith(
        eventUuid,
        submissionData.email,
        [{ attributeUuid: "attr-1", value: "value-1" }],
        { trustedFileValues: true },
      );
      expect(result).toBeDefined();
    });

    it("should update existing participant if it is not a registration form", async () => {
      const submissionData = {
        participantId,
        attributes: [[{ attributeUuid: "attr-1", value: "updated-value" }]],
      } as unknown as FormSubmitionDto;

      mockPrismaService.event.findUnique.mockResolvedValue({
        uuid: eventUuid,
        registerFormUuid: "other-form-uuid",
      });

      mockPrismaService.form.findUnique.mockResolvedValue({
        uuid: formUuid,
        formDefinitions: [
          {
            attributeUuid: "attr-1",
            isRequired: false,
            attribute: { uuid: "attr-1" },
          },
        ],
      });

      jest.spyOn(service, "isOpen").mockResolvedValue(true);
      mockParticipantsService.update.mockResolvedValue({
        id: participantId,
        status: "updated",
      });

      await service.formSubmit(eventSlug, formUuid, submissionData);

      expect(mockParticipantsService.update).toHaveBeenCalledWith(
        eventUuid,
        participantId,
        expect.objectContaining({
          participantAttributes: [
            { attributeUuid: "attr-1", value: "updated-value" },
          ],
        }),
        { trustedFileValues: true },
      );
    });

    it("should throw BadRequestException if registration limit is reached", async () => {
      mockPrismaService.event.findUnique.mockResolvedValue({
        uuid: eventUuid,
        registerFormUuid: formUuid,
        participants: Array.from({ length: 5 }),
        participantsLimit: 5,
      });

      mockPrismaService.form.findUnique.mockResolvedValue({
        uuid: formUuid,
        formDefinitions: [],
      });
      jest.spyOn(service, "isOpen").mockResolvedValue(true);

      const submissionData = {
        email: "full@test.com",
        attributes: [],
      } as unknown as FormSubmitionDto;

      await expect(
        service.formSubmit(eventSlug, formUuid, submissionData),
      ).rejects.toThrow(
        `Event with a slug: ${eventSlug} has reached the participants limit`,
      );
    });

    it("should resolve a drawing attribute's upload token to its file key, like a file attribute", async () => {
      const token = "550e8400-e29b-41d4-a716-446655440099";
      const submissionData = {
        email: "test@example.com",
        attributes: [[{ attributeUuid: "attr-drawing", value: token }]],
      } as unknown as FormSubmitionDto;

      mockPrismaService.event.findUnique.mockResolvedValue({
        uuid: eventUuid,
        registerFormUuid: formUuid,
        participants: [],
        participantsLimit: 10,
      });
      mockPrismaService.form.findUnique.mockResolvedValue({
        uuid: formUuid,
        formDefinitions: [
          {
            attributeUuid: "attr-drawing",
            isRequired: false,
            attribute: { uuid: "attr-drawing", type: AttributeType.drawing },
          },
        ],
      });
      mockPrismaService.uploadedFile.findUnique.mockResolvedValue({
        uuid: token,
        formUuid,
        claimedAt: null,
        fileKey: "drawing-key.png",
        mimeType: "image/png",
      });
      jest.spyOn(service, "isOpen").mockResolvedValue(true);
      mockParticipantsService.register.mockResolvedValue({
        id: 1,
        email: submissionData.email,
      });

      await service.formSubmit(eventSlug, formUuid, submissionData);

      expect(mockParticipantsService.register).toHaveBeenCalledWith(
        eventUuid,
        submissionData.email,
        [{ attributeUuid: "attr-drawing", value: "drawing-key.png" }],
        { trustedFileValues: true },
      );
    });

    it("should reject a drawing attribute upload whose file is not an image", async () => {
      const token = "550e8400-e29b-41d4-a716-446655440099";
      const submissionData = {
        email: "test@example.com",
        attributes: [[{ attributeUuid: "attr-drawing", value: token }]],
      } as unknown as FormSubmitionDto;

      mockPrismaService.event.findUnique.mockResolvedValue({
        uuid: eventUuid,
        registerFormUuid: formUuid,
        participants: [],
        participantsLimit: 10,
      });
      mockPrismaService.form.findUnique.mockResolvedValue({
        uuid: formUuid,
        formDefinitions: [
          {
            attributeUuid: "attr-drawing",
            isRequired: false,
            attribute: { uuid: "attr-drawing", type: AttributeType.drawing },
          },
        ],
      });
      mockPrismaService.uploadedFile.findUnique.mockResolvedValue({
        uuid: token,
        formUuid,
        claimedAt: null,
        fileKey: "not-an-image.pdf",
        mimeType: "application/pdf",
      });
      jest.spyOn(service, "isOpen").mockResolvedValue(true);

      await expect(
        service.formSubmit(eventSlug, formUuid, submissionData),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject a malformed (non-UUID) file token with 400 without querying the database", async () => {
      const submissionData = {
        email: "test@example.com",
        attributes: [
          [{ attributeUuid: "attr-file", value: "not-a-valid-token" }],
        ],
      } as unknown as FormSubmitionDto;

      mockPrismaService.event.findUnique.mockResolvedValue({
        uuid: eventUuid,
        registerFormUuid: formUuid,
        participants: [],
        participantsLimit: 10,
      });
      mockPrismaService.form.findUnique.mockResolvedValue({
        uuid: formUuid,
        formDefinitions: [
          {
            attributeUuid: "attr-file",
            isRequired: false,
            attribute: { uuid: "attr-file", type: AttributeType.file },
          },
        ],
      });
      jest.spyOn(service, "isOpen").mockResolvedValue(true);

      await expect(
        service.formSubmit(eventSlug, formUuid, submissionData),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.uploadedFile.findUnique).not.toHaveBeenCalled();
    });

    it("should not fail an update submission that omits a required file attribute the participant already has", async () => {
      const submissionData = {
        participantId,
        attributes: [],
      } as unknown as FormSubmitionDto;

      mockPrismaService.event.findUnique.mockResolvedValue({
        uuid: eventUuid,
        registerFormUuid: "other-form-uuid",
      });
      mockPrismaService.form.findUnique.mockResolvedValue({
        uuid: formUuid,
        formDefinitions: [
          {
            attributeUuid: "attr-file",
            isRequired: true,
            attribute: { uuid: "attr-file", type: AttributeType.file },
          },
        ],
      });
      mockPrismaService.participantAttribute.findMany.mockResolvedValueOnce([
        { attributeUuid: "attr-file", value: "existing-key.png" },
      ]);
      jest.spyOn(service, "isOpen").mockResolvedValue(true);
      mockParticipantsService.update.mockResolvedValue({
        id: participantId,
        status: "updated",
      });

      await service.formSubmit(eventSlug, formUuid, submissionData);

      expect(mockParticipantsService.update).toHaveBeenCalledWith(
        eventUuid,
        participantId,
        expect.objectContaining({ participantAttributes: [] }),
        { trustedFileValues: true },
      );
    });

    it("should fail a registration submission that omits a required attribute", async () => {
      const submissionData = {
        email: "test@example.com",
        attributes: [],
      } as unknown as FormSubmitionDto;

      mockPrismaService.event.findUnique.mockResolvedValue({
        uuid: eventUuid,
        registerFormUuid: formUuid,
        participants: [],
        participantsLimit: 10,
      });
      mockPrismaService.form.findUnique.mockResolvedValue({
        uuid: formUuid,
        formDefinitions: [
          {
            attributeUuid: "attr-required",
            isRequired: true,
            attribute: { uuid: "attr-required", type: AttributeType.text },
          },
        ],
      });
      jest.spyOn(service, "isOpen").mockResolvedValue(true);

      await expect(
        service.formSubmit(eventSlug, formUuid, submissionData),
      ).rejects.toThrow(BadRequestException);
      expect(
        mockPrismaService.participantAttribute.findMany,
      ).not.toHaveBeenCalled();
    });
  });
});
