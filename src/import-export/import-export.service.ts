import { isEmail } from "class-validator";
import * as ExcelJS from "exceljs";
import { Prisma } from "src/generated/prisma/client";
import { AttributeType } from "src/generated/prisma/enums";
import {
  ParticipantAttributeDto,
  ParticipantCreateDto,
} from "src/participants/dto/participant-create.dto";
import { Participant } from "src/participants/entities/participant.entity";
import { ParticipantsService } from "src/participants/participants.service";
import { PrismaService } from "src/prisma/prisma.service";

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  ExportParticipantsQueryDto,
  ParticipantsExportFormat,
} from "./dto/export-participants-query.dto";
import {
  ImportSkipReason,
  ParticipantsImportResultDto,
  SkippedParticipantDto,
} from "./dto/participants-import-result.dto";
import {
  ParticipantsExportPayload,
  ParticipantsExporter,
} from "./exporters/participants-exporter.interface";
import { ParticipantsXlsxExporter } from "./exporters/participants-xlsx.exporter";
import { buildAttributeHeaders } from "./utils/attribute-headers";

export interface ExportedFile {
  fileName: string;
  mimeType: string;
  content: Buffer;
}

interface EventAttribute {
  uuid: string;
  name: string;
  type: AttributeType;
}

type BlockNameIndex = Map<string, Map<string, string[]>>;

const MAX_IMPORT_PARTICIPANTS = 2000;
const MAX_IMPORT_ERROR_MESSAGE = `Maximum of ${String(MAX_IMPORT_PARTICIPANTS)} participants per request`;

@Injectable()
export class ImportExportService {
  private readonly exporters: Map<
    ParticipantsExportFormat,
    ParticipantsExporter
  >;

  constructor(
    private readonly prisma: PrismaService,
    private readonly participantsService: ParticipantsService,
    participantsXlsxExporter: ParticipantsXlsxExporter,
  ) {
    this.exporters = new Map<ParticipantsExportFormat, ParticipantsExporter>([
      [participantsXlsxExporter.format, participantsXlsxExporter],
    ]);
  }

  async exportParticipants(
    eventId: string,
    query: ExportParticipantsQueryDto,
  ): Promise<ExportedFile> {
    await this.assertEventExists(eventId);

    const participantIds = this.deduplicateUuids(query.participantIds);
    const attributeIds = this.deduplicateUuids(query.attributeIds);

    await this.validateParticipantMembership(eventId, participantIds);
    const attributes = await this.resolveAttributes(eventId, attributeIds);

    const participants = await this.prisma.participant.findMany({
      where: {
        eventUuid: eventId,
        ...(participantIds == null ? {} : { uuid: { in: participantIds } }),
      },
      orderBy: { email: "asc" },
      select: {
        uuid: true,
        email: true,
        attributes: {
          where: {
            ...(attributes.length > 0
              ? {
                  attributeUuid: {
                    in: attributes.map((attribute) => attribute.uuid),
                  },
                }
              : {}),
          },
          select: {
            attributeUuid: true,
            value: true,
          },
        },
      },
    });

    const payload: ParticipantsExportPayload = {
      attributes: attributes.map((attribute) => ({
        uuid: attribute.uuid,
        name: attribute.name,
      })),
      rows: participants.map((participant) => ({
        participantUuid: participant.uuid,
        email: participant.email,
        attributes: Object.fromEntries(
          participant.attributes.map((attribute) => [
            attribute.attributeUuid,
            this.formatAttributeValue(attribute.value),
          ]),
        ),
      })),
    };

    const format = query.format ?? ParticipantsExportFormat.xlsx;
    const exporter = this.exporters.get(format);
    if (exporter == null) {
      throw new BadRequestException(`Export format ${format} is not supported`);
    }

    return {
      fileName: `participants-export-${eventId}.${exporter.fileExtension}`,
      mimeType: exporter.mimeType,
      content: await exporter.build(payload),
    };
  }

  async importParticipants(
    eventId: string,
    participants: ParticipantCreateDto[],
  ): Promise<ParticipantsImportResultDto> {
    await this.assertEventExists(eventId);
    return this.processImport(eventId, participants, new Map());
  }

  async importParticipantsFromXlsx(
    eventId: string,
    buffer: Buffer,
  ): Promise<ParticipantsImportResultDto> {
    await this.assertEventExists(eventId);

    const attributes = await this.resolveAttributes(eventId);
    const participants = await this.parseXlsxToDto(buffer, attributes);
    const blockIndex = await this.buildBlockNameIndex(attributes);

    return this.processImport(eventId, participants, blockIndex);
  }

  private async processImport(
    eventId: string,
    participants: ParticipantCreateDto[],
    blockIndex: BlockNameIndex,
  ): Promise<ParticipantsImportResultDto> {
    if (participants.length > MAX_IMPORT_PARTICIPANTS) {
      throw new BadRequestException(MAX_IMPORT_ERROR_MESSAGE);
    }

    const importedParticipants: Participant[] = [];
    const skippedParticipants: SkippedParticipantDto[] = [];

    if (participants.length === 0) {
      return { importedParticipants, skippedParticipants };
    }

    const skip = (
      email: string,
      reason: ImportSkipReason,
      message: string,
    ): void => {
      skippedParticipants.push({ email, reason, message });
    };

    const items = participants.map((dto) => ({
      dto,
      email: dto.email.trim().toLowerCase(),
    }));

    const seenEmails = new Set<string>();
    const duplicateIndexes = new Set<number>();
    for (const [index, { email }] of items.entries()) {
      if (!isEmail(email)) {
        continue;
      }
      if (seenEmails.has(email)) {
        duplicateIndexes.add(index);
      } else {
        seenEmails.add(email);
      }
    }

    const existing = await this.prisma.participant.findMany({
      where: { eventUuid: eventId, email: { in: [...seenEmails] } },
      select: { email: true },
    });
    const existingEmails = new Set(
      existing.map((participant) => participant.email.toLowerCase()),
    );

    for (const [index, { dto, email }] of items.entries()) {
      if (!isEmail(email)) {
        skip(email, "failed", "Invalid or missing email");
        continue;
      }
      if (duplicateIndexes.has(index)) {
        skip(
          email,
          "duplicate_in_file",
          "Email appears more than once in the imported data",
        );
        continue;
      }
      if (existingEmails.has(email)) {
        skip(
          email,
          "already_exists",
          "Participant with this email already exists in this event",
        );
        continue;
      }

      try {
        const attributes =
          this.resolveBlockNames(dto.participantAttributes, blockIndex) ?? [];
        const participant = await this.participantsService.register(
          eventId,
          email,
          attributes,
        );
        importedParticipants.push(participant);
      } catch (error) {
        skip(
          email,
          "failed",
          error instanceof Error ? error.message : "Unknown error",
        );
      }
    }

    return { importedParticipants, skippedParticipants };
  }

  private async assertEventExists(eventId: string): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { uuid: eventId },
      select: { uuid: true },
    });
    if (event == null) {
      throw new NotFoundException("Event not found");
    }
  }

  private deduplicateUuids(ids?: string[]): string[] | undefined {
    if (ids == null || ids.length === 0) {
      return undefined;
    }

    return [...new Set(ids)];
  }

  private async validateParticipantMembership(
    eventId: string,
    participantIds?: string[],
  ): Promise<void> {
    if (participantIds == null || participantIds.length === 0) {
      return;
    }

    const validParticipantsCount = await this.prisma.participant.count({
      where: {
        eventUuid: eventId,
        uuid: { in: participantIds },
      },
    });

    if (validParticipantsCount !== participantIds.length) {
      throw new BadRequestException(
        "One or more participantIds do not belong to this event",
      );
    }
  }

  private async resolveAttributes(
    eventId: string,
    attributeIds?: string[],
  ): Promise<EventAttribute[]> {
    const where: Prisma.AttributeWhereInput = {
      eventUuid: eventId,
      ...(attributeIds == null ? {} : { uuid: { in: attributeIds } }),
    };

    const attributes = await this.prisma.attribute.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { uuid: true, name: true, type: true },
    });

    if (
      attributeIds != null &&
      attributeIds.length > 0 &&
      attributes.length !== attributeIds.length
    ) {
      throw new BadRequestException(
        "One or more attributeIds do not belong to this event",
      );
    }

    return attributes;
  }

  private formatAttributeValue(value: Prisma.JsonValue | null): string {
    if (value == null) {
      return "";
    }

    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.formatUnknownValue(item)).join("; ");
    }

    return JSON.stringify(value);
  }

  private formatUnknownValue(value: unknown): string {
    if (value == null) {
      return "";
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return String(value);
    }

    return JSON.stringify(value);
  }

  private async buildBlockNameIndex(
    attributes: EventAttribute[],
  ): Promise<BlockNameIndex> {
    const index: BlockNameIndex = new Map();

    const blockAttributeUuids = attributes
      .filter((attribute) => attribute.type === AttributeType.block)
      .map((attribute) => attribute.uuid);
    if (blockAttributeUuids.length === 0) {
      return index;
    }

    const blocks = await this.prisma.block.findMany({
      where: { attributeUuid: { in: blockAttributeUuids } },
      select: { uuid: true, name: true, attributeUuid: true },
    });

    for (const block of blocks) {
      if (block.attributeUuid == null) {
        continue;
      }

      const byName =
        index.get(block.attributeUuid) ?? new Map<string, string[]>();
      const name = block.name.trim();
      byName.set(name, [...(byName.get(name) ?? []), block.uuid]);
      index.set(block.attributeUuid, byName);
    }

    return index;
  }

  private resolveBlockNames(
    attributes: ParticipantAttributeDto[] | undefined,
    blockIndex: BlockNameIndex,
  ): ParticipantAttributeDto[] | undefined {
    if (attributes == null) {
      return attributes;
    }

    return attributes.map((attribute) => {
      const byName = blockIndex.get(attribute.attributeUuid);
      if (byName == null || typeof attribute.value !== "string") {
        return attribute;
      }

      const uuids = attribute.value
        .split(";")
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
        .map((name) => {
          const matches = byName.get(name) ?? [];
          if (matches.length === 0) {
            throw new BadRequestException(
              `Block "${name}" not found for attribute ${attribute.attributeUuid}`,
            );
          }
          if (matches.length > 1) {
            throw new BadRequestException(
              `Block name "${name}" is ambiguous for attribute ${attribute.attributeUuid}`,
            );
          }
          return matches[0];
        });

      const resolved = new ParticipantAttributeDto();
      resolved.attributeUuid = attribute.attributeUuid;
      resolved.value = uuids.join(";");
      return resolved;
    });
  }

  private async parseXlsxToDto(
    buffer: Buffer,
    attributes: { uuid: string; name: string }[],
  ): Promise<ParticipantCreateDto[]> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    } catch {
      throw new BadRequestException("Invalid or corrupted Excel file");
    }

    const worksheet = workbook.worksheets.at(0);
    if (worksheet == null || worksheet.rowCount === 0) {
      return [];
    }

    const headers = buildAttributeHeaders(attributes);
    const expectedAttributeHeaders = new Map<string, string>(
      headers.map((header, index) => [header, attributes[index].uuid]),
    );

    const columnMap = new Map<number, string>();
    const seenKeys = new Set<string>();

    worksheet.getRow(1).eachCell((cell, colNumber) => {
      const headerValue = cell.text.trim();
      if (!headerValue) {
        return;
      }

      const key =
        headerValue.toLowerCase() === "email" ||
        headerValue.toLowerCase() === "participantuuid"
          ? headerValue
          : expectedAttributeHeaders.get(headerValue);

      if (key == null) {
        throw new BadRequestException(
          `Unknown column header: "${headerValue}"`,
        );
      }
      if (seenKeys.has(key)) {
        throw new BadRequestException(
          `Duplicate column header: "${headerValue}"`,
        );
      }

      seenKeys.add(key);
      columnMap.set(colNumber, key);
    });

    if (!seenKeys.has("email")) {
      throw new BadRequestException('Missing required column: "email"');
    }

    const participants: ParticipantCreateDto[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }

      const participantDto = new ParticipantCreateDto();
      participantDto.email = "";
      const rowAttributes: ParticipantAttributeDto[] = [];
      participantDto.participantAttributes = rowAttributes;

      row.eachCell((cell, colNumber) => {
        const columnKey = columnMap.get(colNumber);
        if (columnKey == null || columnKey === "participantUuid") {
          return;
        }

        const cellValue = cell.text.trim();
        if (!cellValue) {
          return;
        }

        if (columnKey === "email") {
          participantDto.email = cellValue;
        } else {
          rowAttributes.push({
            attributeUuid: columnKey,
            value: cellValue,
          });
        }
      });

      if (participantDto.email.length > 0 || rowAttributes.length > 0) {
        if (participants.length >= MAX_IMPORT_PARTICIPANTS) {
          throw new BadRequestException(MAX_IMPORT_ERROR_MESSAGE);
        }
        participants.push(participantDto);
      }
    });

    return participants;
  }
}
