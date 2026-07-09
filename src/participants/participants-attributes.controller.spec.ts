import type { Response } from "express";
import { PrismaService } from "src/prisma/prisma.service";
import { StorageService } from "src/storage/storage.service";

import { NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import type { ParticipantBulkUpdateDto } from "./dto/participant-bulk-update.dto";
import { ParticipantsAttributesController } from "./participants-attributes.controller";
import { ParticipantsService } from "./participants.service";

const mockResponseFunction = () => {
  const response: Partial<Response> = {};
  response.redirect = jest.fn().mockReturnValue(response);
  return response as Response;
};

describe("ParticipantsAttributesController", () => {
  let controller: ParticipantsAttributesController;

  const mockParticipantsService = {
    bulkUpdateAttributes: jest.fn(),
  };

  const mockPrismaService = {
    participantAttribute: {
      findFirst: jest.fn(),
    },
  };

  const mockStorageService = {
    getUrl: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn().mockReturnValue("forms-bucket"),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParticipantsAttributesController],
      providers: [
        {
          provide: ParticipantsService,
          useValue: mockParticipantsService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<ParticipantsAttributesController>(
      ParticipantsAttributesController,
    );
    jest.clearAllMocks();
    mockConfigService.getOrThrow.mockReturnValue("forms-bucket");
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("downloadFile", () => {
    const eventUuid = "event-123";
    const participantUuid = "part-123";
    const attributeUuid = "attr-123";

    it("should throw NotFoundException if attribute does not have a value", async () => {
      mockPrismaService.participantAttribute.findFirst.mockResolvedValue({
        value: null,
      });
      const response = mockResponseFunction();

      await expect(
        controller.downloadFile(
          eventUuid,
          participantUuid,
          attributeUuid,
          response,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException if attribute value is empty", async () => {
      mockPrismaService.participantAttribute.findFirst.mockResolvedValue({
        value: "",
      });
      const response = mockResponseFunction();

      await expect(
        controller.downloadFile(
          eventUuid,
          participantUuid,
          attributeUuid,
          response,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should redirect to the storage URL if the attribute has a file", async () => {
      mockPrismaService.participantAttribute.findFirst.mockResolvedValue({
        value: "test.pdf",
      });
      mockStorageService.getUrl.mockReturnValue(
        "https://storage.example.com/forms-bucket/test.pdf",
      );
      const response = mockResponseFunction();

      await controller.downloadFile(
        eventUuid,
        participantUuid,
        attributeUuid,
        response,
      );

      expect(mockStorageService.getUrl).toHaveBeenCalledWith(
        "forms-bucket",
        "test.pdf",
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(response.redirect).toHaveBeenCalledWith(
        "https://storage.example.com/forms-bucket/test.pdf",
      );
    });
  });

  describe("bulkUpdate", () => {
    it("should call bulkUpdateAttributes on the service", async () => {
      const eventUuid = "event-123";
      const attributeUuid = "attr-123";
      const dto: ParticipantBulkUpdateDto = {
        participantIds: ["p-1", "p-2"],
        newValue: "newVal",
      };

      mockParticipantsService.bulkUpdateAttributes.mockResolvedValue(null);

      await controller.bulkUpdate(eventUuid, attributeUuid, dto);

      expect(mockParticipantsService.bulkUpdateAttributes).toHaveBeenCalledWith(
        eventUuid,
        attributeUuid,
        "newVal",
        ["p-1", "p-2"],
      );
    });
  });
});
