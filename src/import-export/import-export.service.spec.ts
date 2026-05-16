import { PrismaService } from "src/prisma/prisma.service";

import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { ParticipantsExportFormat } from "./dto/export-participants-query.dto";
import { ParticipantsXlsxExporter } from "./exporters/participants-xlsx.exporter";
import { ImportExportService } from "./import-export.service";

describe("ImportExportService", () => {
  let service: ImportExportService;

  const mockPrismaService = {
    event: {
      findUnique: jest.fn(),
    },
    participant: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    attribute: {
      findMany: jest.fn(),
    },
  };

  const mockXlsxExporter = {
    format: ParticipantsExportFormat.xlsx,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileExtension: "xlsx",
    build: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportExportService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ParticipantsXlsxExporter,
          useValue: mockXlsxExporter,
        },
      ],
    }).compile();

    service = module.get<ImportExportService>(ImportExportService);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("exportParticipants", () => {
    const eventId = "7ee3f11b-6ddb-4be6-bf73-11be7448f724";

    it("should export all participants and attributes when filters are omitted", async () => {
      mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventId });
      mockPrismaService.attribute.findMany.mockResolvedValue([
        { uuid: "attr-1", name: "T-shirt size" },
        { uuid: "attr-2", name: "Interests" },
      ]);
      mockPrismaService.participant.findMany.mockResolvedValue([
        {
          uuid: "participant-1",
          email: "participant1@example.com",
          attributes: [
            { attributeUuid: "attr-1", value: "M" },
            { attributeUuid: "attr-2", value: ["AI", "Web"] },
          ],
        },
      ]);
      mockXlsxExporter.build.mockResolvedValue(Buffer.from("xlsx-content"));

      const result = await service.exportParticipants(eventId, {});

      expect(mockPrismaService.participant.count).not.toHaveBeenCalled();
      expect(mockPrismaService.participant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { eventUuid: eventId },
        }),
      );
      expect(mockXlsxExporter.build).toHaveBeenCalledWith({
        attributes: [
          { uuid: "attr-1", name: "T-shirt size" },
          { uuid: "attr-2", name: "Interests" },
        ],
        rows: [
          {
            participantUuid: "participant-1",
            email: "participant1@example.com",
            attributes: {
              "attr-1": "M",
              "attr-2": "AI; Web",
            },
          },
        ],
      });
      expect(result).toEqual({
        fileName: `participants-export-${eventId}.xlsx`,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        content: Buffer.from("xlsx-content"),
      });
    });

    it("should validate that participantIds belong to the event", async () => {
      mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventId });
      mockPrismaService.participant.count.mockResolvedValue(1);

      await expect(
        service.exportParticipants(eventId, {
          participantIds: ["p-1", "p-2"],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.attribute.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.participant.findMany).not.toHaveBeenCalled();
      expect(mockXlsxExporter.build).not.toHaveBeenCalled();
    });

    it("should validate that attributeIds belong to the event", async () => {
      mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventId });
      mockPrismaService.participant.count.mockResolvedValue(2);
      mockPrismaService.attribute.findMany.mockResolvedValue([
        { uuid: "attr-1", name: "A1" },
      ]);

      await expect(
        service.exportParticipants(eventId, {
          participantIds: ["p-1", "p-2"],
          attributeIds: ["attr-1", "attr-2"],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.participant.findMany).not.toHaveBeenCalled();
      expect(mockXlsxExporter.build).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when event does not exist", async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(null);

      await expect(service.exportParticipants(eventId, {})).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrismaService.participant.count).not.toHaveBeenCalled();
      expect(mockPrismaService.attribute.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.participant.findMany).not.toHaveBeenCalled();
      expect(mockXlsxExporter.build).not.toHaveBeenCalled();
    });

    it("should filter export by selected participantIds and attributeIds", async () => {
      mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventId });
      mockPrismaService.participant.count.mockResolvedValue(2);
      mockPrismaService.attribute.findMany.mockResolvedValue([
        { uuid: "attr-1", name: "Department" },
        { uuid: "attr-2", name: "Diet" },
      ]);
      mockPrismaService.participant.findMany.mockResolvedValue([
        {
          uuid: "p-1",
          email: "p1@example.com",
          attributes: [{ attributeUuid: "attr-1", value: "IT" }],
        },
      ]);
      mockXlsxExporter.build.mockResolvedValue(Buffer.from("xlsx-content"));

      await service.exportParticipants(eventId, {
        participantIds: ["p-1", "p-2"],
        attributeIds: ["attr-1", "attr-2"],
      });

      expect(mockPrismaService.attribute.findMany).toHaveBeenCalledWith({
        where: {
          eventUuid: eventId,
          uuid: { in: ["attr-1", "attr-2"] },
        },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: { uuid: true, name: true },
      });
      expect(mockPrismaService.participant.findMany).toHaveBeenCalledWith({
        where: {
          eventUuid: eventId,
          uuid: { in: ["p-1", "p-2"] },
        },
        orderBy: { email: "asc" },
        select: {
          uuid: true,
          email: true,
          attributes: {
            where: {
              attributeUuid: { in: ["attr-1", "attr-2"] },
            },
            select: {
              attributeUuid: true,
              value: true,
            },
          },
        },
      });
    });

    it("should throw BadRequestException when requested format is unsupported", async () => {
      mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventId });
      mockPrismaService.attribute.findMany.mockResolvedValue([]);
      mockPrismaService.participant.findMany.mockResolvedValue([]);

      await expect(
        service.exportParticipants(eventId, {
          format: "csv" as ParticipantsExportFormat,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
