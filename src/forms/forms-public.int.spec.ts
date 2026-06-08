import { HcaptchaGuard } from "@gvrs/nestjs-hcaptcha";
import { BlocksService } from "src/blocks/blocks.service";
import { ParticipantsService } from "src/participants/participants.service";
import { PrismaService } from "src/prisma/prisma.service";
import { StorageService } from "src/storage/storage.service";

import { ConfigService } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { FormsPublicController } from "./forms-public.controller";
import { FormsService } from "./forms.service";

describe("Forms Public Integration", () => {
  let formsPublicController: FormsPublicController;

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
        FormsPublicController,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        ParticipantsService,
        BlocksService,
        {
          provide: StorageService,
          useValue: { upload: jest.fn(), delete: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue("test-bucket") },
        },
      ],
    })
      .overrideGuard(HcaptchaGuard)
      .useValue({ canActivate: () => true })
      .compile();
    formsPublicController = module.get<FormsPublicController>(
      FormsPublicController,
    );
  });

  it("should be defined", () => {
    expect(formsPublicController).toBeDefined();
  });

  describe("findOne", () => {
    it("should get a form by id for an event", async () => {
      const mockForm = {
        uuid: "form-uuid-1",
        name: "Form 1",
        openDate: new Date(),
        closeDate: new Date(),
        description: "First form",
      };
      mockPrismaService.form.findUnique.mockResolvedValue(mockForm);
      const result = await formsPublicController.findOne(
        "event",
        "form-uuid-1",
      );
      expect(result).toEqual(mockForm);
    });

    it("should throw NotFoundException if form not found by id for an event", async () => {
      mockPrismaService.form.findUnique.mockResolvedValue(null);
      await expect(
        formsPublicController.findOne("event", "non-existent-form-uuid"),
      ).rejects.toThrow();
    });
  });
});
