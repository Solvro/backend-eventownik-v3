import { Prisma } from "src/generated/prisma/client";
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
  ParticipantsExportPayload,
  ParticipantsExporter,
} from "./exporters/participants-exporter.interface";
import { ParticipantsXlsxExporter } from "./exporters/participants-xlsx.exporter";

export interface ExportedFile {
  fileName: string;
  mimeType: string;
  content: Buffer;
}

@Injectable()
export class ImportExportService {
  private readonly exporters: Map<
    ParticipantsExportFormat,
    ParticipantsExporter
  >;

  constructor(
    private readonly prisma: PrismaService,
    participantsXlsxExporter: ParticipantsXlsxExporter,
  ) {
    this.exporters = new Map([
      [participantsXlsxExporter.format, participantsXlsxExporter],
    ]);
  }

  async exportParticipants(
    eventId: string,
    query: ExportParticipantsQueryDto,
  ): Promise<ExportedFile> {
    const eventExists = await this.prisma.event.findUnique({
      where: { uuid: eventId },
      select: { uuid: true },
    });
    if (eventExists == null) {
      throw new NotFoundException("Event not found");
    }

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

    const format = query.format ?? "xlsx";
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
  ): Promise<{ uuid: string; name: string }[]> {
    const where: Prisma.AttributeWhereInput = {
      eventUuid: eventId,
      ...(attributeIds == null ? {} : { uuid: { in: attributeIds } }),
    };

    const attributes = await this.prisma.attribute.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { uuid: true, name: true },
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
}
