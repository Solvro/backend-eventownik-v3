import * as ExcelJS from "exceljs";
import { AttributeType } from "src/generated/prisma/enums";
import type { ParticipantCreateDto } from "src/participants/dto/participant-create.dto";
import { ParticipantsService } from "src/participants/participants.service";
import { PrismaService } from "src/prisma/prisma.service";

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { ParticipantsExportFormat } from "./dto/export-participants-query.dto";
import { ParticipantsXlsxExporter } from "./exporters/participants-xlsx.exporter";
import { ImportExportService } from "./import-export.service";

async function buildXlsx(rows: unknown[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Participants");
  for (const row of rows) {
    worksheet.addRow(row);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function toDto(
  email: string,
  participantAttributes?: { attributeUuid: string; value?: unknown }[],
): ParticipantCreateDto {
  return { email, participantAttributes };
}

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
    block: {
      findMany: jest.fn(),
    },
  };

  const mockParticipantsService = {
    register: jest.fn(),
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
          provide: ParticipantsService,
          useValue: mockParticipantsService,
        },
        {
          provide: ParticipantsXlsxExporter,
          useValue: mockXlsxExporter,
        },
      ],
    }).compile();

    service = module.get<ImportExportService>(ImportExportService);
    jest.resetAllMocks();
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
        select: { uuid: true, name: true, type: true },
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

  describe("import", () => {
    const eventId = "7ee3f11b-6ddb-4be6-bf73-11be7448f724";

    const sizeAttribute = {
      uuid: "attr-size",
      name: "Size",
      type: AttributeType.select,
    };
    const groupAttribute = {
      uuid: "attr-group",
      name: "Group",
      type: AttributeType.block,
    };

    beforeEach(() => {
      mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventId });
      mockPrismaService.participant.findMany.mockResolvedValue([]);
      mockPrismaService.attribute.findMany.mockResolvedValue([]);
      mockPrismaService.block.findMany.mockResolvedValue([]);
      mockParticipantsService.register.mockImplementation(
        (_eventId: string, email: string) => ({ uuid: `uuid-${email}`, email }),
      );
    });

    describe("importParticipants (JSON)", () => {
      it("should throw NotFoundException when event does not exist", async () => {
        mockPrismaService.event.findUnique.mockResolvedValue(null);

        await expect(
          service.importParticipants(eventId, [toDto("a@example.com")]),
        ).rejects.toThrow(NotFoundException);

        expect(mockParticipantsService.register).not.toHaveBeenCalled();
      });

      it("should register every new participant", async () => {
        const result = await service.importParticipants(eventId, [
          toDto("a@example.com", [{ attributeUuid: "attr-size", value: "M" }]),
          toDto("b@example.com"),
        ]);

        expect(result.skippedParticipants).toEqual([]);
        expect(result.importedParticipants).toEqual([
          { uuid: "uuid-a@example.com", email: "a@example.com" },
          { uuid: "uuid-b@example.com", email: "b@example.com" },
        ]);
        expect(mockParticipantsService.register).toHaveBeenNthCalledWith(
          1,
          eventId,
          "a@example.com",
          [{ attributeUuid: "attr-size", value: "M" }],
        );
        expect(mockParticipantsService.register).toHaveBeenNthCalledWith(
          2,
          eventId,
          "b@example.com",
          [],
        );
      });

      it("should normalize emails with trim and toLowerCase", async () => {
        await service.importParticipants(eventId, [
          toDto("  Jan.Kowalski@Example.COM  "),
        ]);

        expect(mockParticipantsService.register).toHaveBeenCalledWith(
          eventId,
          "jan.kowalski@example.com",
          [],
        );
      });

      it("should mark repeated emails within the batch as duplicate_in_file", async () => {
        const result = await service.importParticipants(eventId, [
          toDto("a@example.com"),
          toDto("b@example.com"),
          toDto("A@example.com"),
        ]);

        expect(result.importedParticipants.map((p) => p.email)).toEqual([
          "a@example.com",
          "b@example.com",
        ]);
        expect(result.skippedParticipants).toEqual([
          {
            email: "a@example.com",
            reason: "duplicate_in_file",
            message: expect.any(String) as string,
          },
        ]);
        expect(mockParticipantsService.register).toHaveBeenCalledTimes(2);
      });

      it("should detect duplicates before any write, so the database is not consulted per row", async () => {
        await service.importParticipants(eventId, [
          toDto("a@example.com"),
          toDto("a@example.com"),
          toDto("b@example.com"),
        ]);

        expect(mockPrismaService.participant.findMany).toHaveBeenCalledTimes(1);
        expect(mockPrismaService.participant.findMany).toHaveBeenCalledWith({
          where: {
            eventUuid: eventId,
            email: { in: ["a@example.com", "b@example.com"] },
          },
          select: { email: true },
        });
      });

      it("should mark emails already registered in the event as already_exists (case-insensitive)", async () => {
        mockPrismaService.participant.findMany.mockResolvedValue([
          { email: "Existing@Example.com" },
        ]);

        const result = await service.importParticipants(eventId, [
          toDto("existing@example.com"),
          toDto("new@example.com"),
        ]);

        expect(result.importedParticipants.map((p) => p.email)).toEqual([
          "new@example.com",
        ]);
        expect(result.skippedParticipants).toEqual([
          {
            email: "existing@example.com",
            reason: "already_exists",
            message: expect.any(String) as string,
          },
        ]);
        expect(mockParticipantsService.register).toHaveBeenCalledTimes(1);
      });

      it("should mark a row with an invalid email as failed", async () => {
        const result = await service.importParticipants(eventId, [
          toDto("not-an-email"),
          toDto("ok@example.com"),
        ]);

        expect(result.importedParticipants).toHaveLength(1);
        expect(result.skippedParticipants).toEqual([
          {
            email: "not-an-email",
            reason: "failed",
            message: expect.any(String) as string,
          },
        ]);
      });

      it("should not abort the batch when register throws for one row", async () => {
        mockParticipantsService.register
          .mockResolvedValueOnce({ uuid: "u1", email: "a@example.com" })
          .mockRejectedValueOnce(
            new ConflictException("Participant already exists (race)"),
          )
          .mockResolvedValueOnce({ uuid: "u3", email: "c@example.com" });

        const result = await service.importParticipants(eventId, [
          toDto("a@example.com"),
          toDto("b@example.com"),
          toDto("c@example.com"),
        ]);

        expect(result.importedParticipants.map((p) => p.email)).toEqual([
          "a@example.com",
          "c@example.com",
        ]);
        expect(result.skippedParticipants).toEqual([
          {
            email: "b@example.com",
            reason: "failed",
            message: "Participant already exists (race)",
          },
        ]);
        expect(mockParticipantsService.register).toHaveBeenCalledTimes(3);
      });

      it("should report attribute validation errors from register as failed", async () => {
        mockParticipantsService.register.mockRejectedValueOnce(
          new BadRequestException("Invalid value for attribute attr-size."),
        );

        const result = await service.importParticipants(eventId, [
          toDto("a@example.com", [{ attributeUuid: "attr-size", value: "XL" }]),
          toDto("b@example.com"),
        ]);

        expect(result.importedParticipants).toHaveLength(1);
        expect(result.skippedParticipants).toEqual([
          {
            email: "a@example.com",
            reason: "failed",
            message: "Invalid value for attribute attr-size.",
          },
        ]);
      });

      it("should accept exactly 2000 participants", async () => {
        const participants = Array.from({ length: 2000 }, (_, index) =>
          toDto(`p${String(index)}@example.com`),
        );

        const result = await service.importParticipants(eventId, participants);

        expect(result.importedParticipants).toHaveLength(2000);
      });

      it("should reject more than 2000 participants before touching the database", async () => {
        const participants = Array.from({ length: 2001 }, (_, index) =>
          toDto(`p${String(index)}@example.com`),
        );

        await expect(
          service.importParticipants(eventId, participants),
        ).rejects.toThrow(BadRequestException);

        expect(mockPrismaService.participant.findMany).not.toHaveBeenCalled();
        expect(mockParticipantsService.register).not.toHaveBeenCalled();
      });

      it("should pass block values through untouched (UUIDs are validated by register)", async () => {
        mockParticipantsService.register.mockRejectedValueOnce(
          new BadRequestException(
            "Attribute attr-group must contain valid block UUIDs.",
          ),
        );

        const result = await service.importParticipants(eventId, [
          toDto("a@example.com", [
            { attributeUuid: "attr-group", value: "Workshop A" },
          ]),
          toDto("b@example.com"),
        ]);

        expect(mockPrismaService.block.findMany).not.toHaveBeenCalled();
        expect(mockParticipantsService.register).toHaveBeenNthCalledWith(
          1,
          eventId,
          "a@example.com",
          [{ attributeUuid: "attr-group", value: "Workshop A" }],
        );
        expect(result.importedParticipants).toHaveLength(1);
        expect(result.skippedParticipants).toEqual([
          {
            email: "a@example.com",
            reason: "failed",
            message: "Attribute attr-group must contain valid block UUIDs.",
          },
        ]);
      });
    });

    describe("importParticipantsFromXlsx", () => {
      beforeEach(() => {
        mockPrismaService.attribute.findMany.mockResolvedValue([sizeAttribute]);
      });

      it("should map columns to attributes and ignore participantUuid", async () => {
        const file = await buildXlsx([
          ["participantUuid", "email", "Size"],
          ["some-existing-uuid", "A@Example.com", "M"],
        ]);

        const result = await service.importParticipantsFromXlsx(eventId, file);

        expect(result.skippedParticipants).toEqual([]);
        expect(result.importedParticipants).toHaveLength(1);
        expect(mockParticipantsService.register).toHaveBeenCalledWith(
          eventId,
          "a@example.com",
          [{ attributeUuid: "attr-size", value: "M" }],
        );
      });

      it("should not send empty cells as attributes", async () => {
        const file = await buildXlsx([
          ["email", "Size"],
          ["a@example.com", null],
        ]);

        await service.importParticipantsFromXlsx(eventId, file);

        expect(mockParticipantsService.register).toHaveBeenCalledWith(
          eventId,
          "a@example.com",
          [],
        );
      });

      it("should read the text of hyperlink cells (Excel turns emails into hyperlinks)", async () => {
        const file = await buildXlsx([
          ["email"],
          [{ text: "h@example.com", hyperlink: "mailto:h@example.com" }],
        ]);

        await service.importParticipantsFromXlsx(eventId, file);

        expect(mockParticipantsService.register).toHaveBeenCalledWith(
          eventId,
          "h@example.com",
          [],
        );
      });

      it("should require the uuid suffix for the second and later attributes with the same name (same as the exporter)", async () => {
        mockPrismaService.attribute.findMany.mockResolvedValue([
          { uuid: "attr-1", name: "Note", type: AttributeType.text },
          { uuid: "attr-2", name: "Note", type: AttributeType.text },
        ]);
        const file = await buildXlsx([
          ["email", "Note", "Note (attr-2)"],
          ["a@example.com", "first", "second"],
        ]);

        await service.importParticipantsFromXlsx(eventId, file);

        expect(mockParticipantsService.register).toHaveBeenCalledWith(
          eventId,
          "a@example.com",
          [
            { attributeUuid: "attr-1", value: "first" },
            { attributeUuid: "attr-2", value: "second" },
          ],
        );
      });

      it("should reject the whole file when a header is unknown, before writing anything", async () => {
        const file = await buildXlsx([
          ["email", "Size", "Remarks"],
          ["a@example.com", "M", "hello"],
        ]);

        await expect(
          service.importParticipantsFromXlsx(eventId, file),
        ).rejects.toThrow('Unknown column header: "Remarks"');

        expect(mockPrismaService.participant.findMany).not.toHaveBeenCalled();
        expect(mockParticipantsService.register).not.toHaveBeenCalled();
      });

      it("should reject a file without the email column", async () => {
        const file = await buildXlsx([["Size"], ["M"]]);

        await expect(
          service.importParticipantsFromXlsx(eventId, file),
        ).rejects.toThrow('Missing required column: "email"');
      });

      it("should reject a file with a repeated header", async () => {
        const file = await buildXlsx([
          ["email", "email"],
          ["a@example.com", "b@example.com"],
        ]);

        await expect(
          service.importParticipantsFromXlsx(eventId, file),
        ).rejects.toThrow('Duplicate column header: "email"');
      });

      it("should reject a corrupted file", async () => {
        await expect(
          service.importParticipantsFromXlsx(
            eventId,
            Buffer.from("definitely not an xlsx"),
          ),
        ).rejects.toThrow("Invalid or corrupted Excel file");
      });

      it("should reject more than 2000 data rows", async () => {
        const rows: unknown[][] = [["email"]];
        for (let index = 0; index < 2001; index++) {
          rows.push([`p${String(index)}@example.com`]);
        }
        const file = await buildXlsx(rows);

        await expect(
          service.importParticipantsFromXlsx(eventId, file),
        ).rejects.toThrow(BadRequestException);

        expect(mockParticipantsService.register).not.toHaveBeenCalled();
      });

      it("should return an empty result for a sheet with only a header", async () => {
        const file = await buildXlsx([["email", "Size"]]);

        const result = await service.importParticipantsFromXlsx(eventId, file);

        expect(result).toEqual({
          importedParticipants: [],
          skippedParticipants: [],
        });
        expect(mockParticipantsService.register).not.toHaveBeenCalled();
      });

      it("should mark a row without an email as failed", async () => {
        const file = await buildXlsx([
          ["email", "Size"],
          [null, "M"],
          ["ok@example.com", "S"],
        ]);

        const result = await service.importParticipantsFromXlsx(eventId, file);

        expect(result.importedParticipants).toHaveLength(1);
        expect(result.skippedParticipants).toEqual([
          {
            email: "",
            reason: "failed",
            message: expect.any(String) as string,
          },
        ]);
      });

      it("should detect duplicates inside the file", async () => {
        const file = await buildXlsx([
          ["email"],
          ["a@example.com"],
          ["A@example.com"],
        ]);

        const result = await service.importParticipantsFromXlsx(eventId, file);

        expect(result.importedParticipants).toHaveLength(1);
        expect(result.skippedParticipants).toEqual([
          {
            email: "a@example.com",
            reason: "duplicate_in_file",
            message: expect.any(String) as string,
          },
        ]);
      });

      describe("block attributes", () => {
        beforeEach(() => {
          mockPrismaService.attribute.findMany.mockResolvedValue([
            sizeAttribute,
            groupAttribute,
          ]);
          mockPrismaService.block.findMany.mockResolvedValue([
            {
              uuid: "block-a",
              name: "Workshop A",
              attributeUuid: "attr-group",
            },
            {
              uuid: "block-b",
              name: "Workshop B",
              attributeUuid: "attr-group",
            },
            { uuid: "block-x1", name: "Same", attributeUuid: "attr-group" },
            { uuid: "block-x2", name: "Same", attributeUuid: "attr-group" },
          ]);
        });

        it("should resolve block names to UUIDs with one query for all rows", async () => {
          const file = await buildXlsx([
            ["email", "Group"],
            ["a@example.com", "Workshop A"],
            ["b@example.com", "Workshop A; Workshop B"],
          ]);

          const result = await service.importParticipantsFromXlsx(
            eventId,
            file,
          );

          expect(result.skippedParticipants).toEqual([]);
          expect(mockPrismaService.block.findMany).toHaveBeenCalledTimes(1);
          expect(mockPrismaService.block.findMany).toHaveBeenCalledWith({
            where: { attributeUuid: { in: ["attr-group"] } },
            select: { uuid: true, name: true, attributeUuid: true },
          });
          expect(mockParticipantsService.register).toHaveBeenNthCalledWith(
            1,
            eventId,
            "a@example.com",
            [{ attributeUuid: "attr-group", value: "block-a" }],
          );
          expect(mockParticipantsService.register).toHaveBeenNthCalledWith(
            2,
            eventId,
            "b@example.com",
            [{ attributeUuid: "attr-group", value: "block-a;block-b" }],
          );
        });

        it("should fail only the row with an unknown block name", async () => {
          const file = await buildXlsx([
            ["email", "Group"],
            ["a@example.com", "Nope"],
            ["b@example.com", "Workshop B"],
          ]);

          const result = await service.importParticipantsFromXlsx(
            eventId,
            file,
          );

          expect(result.importedParticipants.map((p) => p.email)).toEqual([
            "b@example.com",
          ]);
          expect(result.skippedParticipants).toHaveLength(1);
          expect(result.skippedParticipants[0]).toMatchObject({
            email: "a@example.com",
            reason: "failed",
          });
          expect(result.skippedParticipants[0].message).toContain("not found");
          expect(mockParticipantsService.register).toHaveBeenCalledTimes(1);
        });

        it("should fail only the row with an ambiguous block name", async () => {
          const file = await buildXlsx([
            ["email", "Group"],
            ["a@example.com", "Same"],
            ["b@example.com", "Workshop A"],
          ]);

          const result = await service.importParticipantsFromXlsx(
            eventId,
            file,
          );

          expect(result.importedParticipants.map((p) => p.email)).toEqual([
            "b@example.com",
          ]);
          expect(result.skippedParticipants[0]).toMatchObject({
            email: "a@example.com",
            reason: "failed",
          });
          expect(result.skippedParticipants[0].message).toContain("ambiguous");
        });
      });

      it("should not query blocks when the event has no block attributes", async () => {
        const file = await buildXlsx([
          ["email", "Size"],
          ["a@example.com", "M"],
        ]);

        await service.importParticipantsFromXlsx(eventId, file);

        expect(mockPrismaService.block.findMany).not.toHaveBeenCalled();
      });

      it("should throw NotFoundException when event does not exist", async () => {
        mockPrismaService.event.findUnique.mockResolvedValue(null);
        const file = await buildXlsx([["email"], ["a@example.com"]]);

        await expect(
          service.importParticipantsFromXlsx(eventId, file),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });
});
