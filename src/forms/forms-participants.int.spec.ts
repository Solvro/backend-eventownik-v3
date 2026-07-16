import { BlocksService } from "src/blocks/blocks.service";
import type { Attribute, Event, Form } from "src/generated/prisma/client";
import { AttributeType } from "src/generated/prisma/enums";
import { ParticipantsService } from "src/participants/participants.service";
import { PrismaService } from "src/prisma/prisma.service";
import { StorageService } from "src/storage/storage.service";

import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import type { FormSubmitionDto } from "./dto/form-submition.dto";
import { FormsService } from "./forms.service";

describe("Forms -> Participants Integration", () => {
  let formsService: FormsService;
  let prisma: PrismaService;
  let mockStorageService: { upload: jest.Mock; delete: jest.Mock };

  const createdEventUuids: string[] = [];

  beforeAll(async () => {
    mockStorageService = {
      upload: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormsService,
        ParticipantsService,
        BlocksService,
        PrismaService,
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue("test-bucket"),
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    formsService = module.get<FormsService>(FormsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await prisma.event.deleteMany({
      where: { uuid: { in: createdEventUuids } },
    });
    await prisma.$disconnect();
  });

  async function createEvent(): Promise<Event> {
    const event = await prisma.event.create({
      data: {
        name: "Test Event",
        slug: `forms-participants-int-${String(Date.now())}-${Math.random().toString(36).slice(2)}`,
        startDate: new Date("2025-06-01"),
        endDate: new Date("2025-06-02"),
      },
    });
    createdEventUuids.push(event.uuid);
    return event;
  }

  async function createAttribute(
    eventUuid: string,
    overrides: Partial<{
      type: AttributeType;
      name: string;
      order: number;
      config: object;
    }> = {},
  ): Promise<Attribute> {
    return prisma.attribute.create({
      data: {
        eventUuid,
        type: AttributeType.text,
        name: "Test Attribute",
        order: 1,
        config: {},
        ...overrides,
      },
    });
  }

  async function createForm(
    eventUuid: string,
    overrides: Partial<{ name: string; isOpen: boolean }> = {},
  ): Promise<Form> {
    return prisma.form.create({
      data: {
        name: "Test Form",
        eventUuid,
        isOpen: true,
        ...overrides,
      },
    });
  }

  async function createFormDefinition(
    formUuid: string,
    attributeUuid: string,
    isRequired: boolean,
  ) {
    return prisma.formDefinition.create({
      data: { formUuid, attributeUuid, isRequired, order: 1 },
    });
  }

  describe("empty optional attributes on submission", () => {
    it("registers a participant successfully when an optional select field is left empty", async () => {
      const event = await createEvent();
      const selectAttribute = await createAttribute(event.uuid, {
        type: AttributeType.select,
        name: "Shirt size",
        config: { options: ["S", "M", "L"] },
      });
      const form = await createForm(event.uuid);
      await prisma.event.update({
        where: { uuid: event.uuid },
        data: { registerFormUuid: form.uuid },
      });
      await createFormDefinition(form.uuid, selectAttribute.uuid, false);

      const submissionData = {
        email: `participant-${String(Date.now())}@example.com`,
        attributes: [[{ attributeUuid: selectAttribute.uuid, value: "" }]],
      } as unknown as FormSubmitionDto;

      const participant = await formsService.formSubmit(
        event.slug,
        form.uuid,
        submissionData,
      );

      expect(participant).toBeDefined();

      const storedAttribute = await prisma.participantAttribute.findUnique({
        where: {
          participantUuid_attributeUuid: {
            participantUuid: participant.uuid,
            attributeUuid: selectAttribute.uuid,
          },
        },
      });
      expect(storedAttribute?.value).toBeNull();
    });

    it("registers a participant successfully when an optional date field is left empty", async () => {
      const event = await createEvent();
      const dateAttribute = await createAttribute(event.uuid, {
        type: AttributeType.date,
        name: "Birthday",
      });
      const form = await createForm(event.uuid);
      await prisma.event.update({
        where: { uuid: event.uuid },
        data: { registerFormUuid: form.uuid },
      });
      await createFormDefinition(form.uuid, dateAttribute.uuid, false);

      const submissionData = {
        email: `participant-${String(Date.now())}@example.com`,
        attributes: [[{ attributeUuid: dateAttribute.uuid, value: "" }]],
      } as unknown as FormSubmitionDto;

      const participant = await formsService.formSubmit(
        event.slug,
        form.uuid,
        submissionData,
      );

      expect(participant).toBeDefined();
    });
  });

  describe("file replacement rollback safety", () => {
    it("does not delete the old file when a later required-field check rejects the submission", async () => {
      const event = await createEvent();
      const fileAttribute = await createAttribute(event.uuid, {
        type: AttributeType.file,
        name: "Resume",
      });
      const requiredTextAttribute = await createAttribute(event.uuid, {
        type: AttributeType.text,
        name: "Full name",
        order: 2,
      });
      const updateForm = await createForm(event.uuid, {
        name: "Profile update form",
      });
      await createFormDefinition(updateForm.uuid, fileAttribute.uuid, false);
      await createFormDefinition(
        updateForm.uuid,
        requiredTextAttribute.uuid,
        true,
      );

      const participant = await prisma.participant.create({
        data: {
          email: `participant-${String(Date.now())}@example.com`,
          eventUuid: event.uuid,
          attributes: {
            create: [
              { attributeUuid: fileAttribute.uuid, value: "old-file-key" },
              {
                attributeUuid: requiredTextAttribute.uuid,
                value: "Existing Name",
              },
            ],
          },
        },
      });

      const uploadedFile = await prisma.uploadedFile.create({
        data: {
          fileKey: "new-file-key",
          originalName: "resume.pdf",
          mimeType: "application/pdf",
          size: 1024,
          formUuid: updateForm.uuid,
          sourceIp: "127.0.0.1",
        },
      });

      // Submit a new file for the (optional) file attribute, but omit the
      // required text attribute entirely so the submission gets rejected
      // after the file token has already been resolved.
      const submissionData = {
        participantId: participant.uuid,
        attributes: [
          [{ attributeUuid: fileAttribute.uuid, value: uploadedFile.uuid }],
        ],
      } as unknown as FormSubmitionDto;

      await expect(
        formsService.formSubmit(event.slug, updateForm.uuid, submissionData),
      ).rejects.toThrow(BadRequestException);

      expect(mockStorageService.delete).not.toHaveBeenCalled();

      const storedFileAttribute = await prisma.participantAttribute.findUnique({
        where: {
          participantUuid_attributeUuid: {
            participantUuid: participant.uuid,
            attributeUuid: fileAttribute.uuid,
          },
        },
      });
      expect(storedFileAttribute?.value).toBe("old-file-key");
    });
  });
});
