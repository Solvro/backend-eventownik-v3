import type { Response } from "express";
import * as fs from "node:fs";
import { PrismaService } from "src/prisma/prisma.service";

import { NotFoundException } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import type { ParticipantBulkUpdateDto } from "./dto/participant-bulk-update.dto";
import { ParticipantsAttributesController } from "./participants-attributes.controller";
import { ParticipantsService } from "./participants.service";

jest.mock("node:fs");

const mockResponseFunction = () => {
  const response: Partial<Response> = {};
  response.download = jest.fn().mockReturnValue(response);
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
      ],
    }).compile();

    controller = module.get<ParticipantsAttributesController>(
      ParticipantsAttributesController,
    );
    jest.clearAllMocks();
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

    it("should throw NotFoundException if file does not exist on disk", async () => {
      mockPrismaService.participantAttribute.findFirst.mockResolvedValue({
        value: "test.pdf",
      });
      (fs.existsSync as jest.Mock).mockReturnValue(false);
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

    it("should download the file if it exists", async () => {
      mockPrismaService.participantAttribute.findFirst.mockResolvedValue({
        value: "test.pdf",
      });
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      const response = mockResponseFunction();

      await controller.downloadFile(
        eventUuid,
        participantUuid,
        attributeUuid,
        response,
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(response.download).toHaveBeenCalled();
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

      mockParticipantsService.bulkUpdateAttributes.mockReturnValue(
        Promise.resolve(),
      );

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
