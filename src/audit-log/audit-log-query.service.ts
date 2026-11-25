import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import { parseSortInput } from "src/common/utils/prisma.utility";
import type { AuditLog, Prisma } from "src/generated/prisma/client";

import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { AuditLogListingDto } from "./dto/audit-log-listing.dto";
import {
  AuditLogChangeDto,
  AuditLogResponseDto,
} from "./dto/audit-log-response.dto";

@Injectable()
export class AuditLogQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    eventUuid: string,
    query: AuditLogListingDto,
  ): Promise<PageDto<AuditLogResponseDto>> {
    const event = await this.prisma.event.findUnique({
      where: { uuid: eventUuid },
      select: { uuid: true },
    });

    if (event === null) {
      throw new NotFoundException("Event not found");
    }

    const { skip, take, sort } = query;

    const where: Prisma.AuditLogWhereInput = {
      eventUuid,
      ...(query.actorType === undefined ? {} : { actorType: query.actorType }),
      ...(query.actorUuid === undefined ? {} : { actorUuid: query.actorUuid }),
      ...(query.action === undefined ? {} : { action: { in: query.action } }),
      ...(query.entityType === undefined
        ? {}
        : { entityType: query.entityType }),
      ...(query.entityUuid === undefined
        ? {}
        : { entityUuid: query.entityUuid }),
      ...(query.from === undefined && query.to === undefined
        ? {}
        : { createdAt: { gte: query.from, lte: query.to } }),
    };

    const orderBy = parseSortInput(sort, ["createdAt"]);
    if (orderBy.length === 0) {
      orderBy.push({ createdAt: "desc" });
    }
    orderBy.push({ uuid: "desc" });

    const [itemCount, entries] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({ where, skip, take, orderBy }),
    ]);

    return new PageDto(
      entries.map((entry) => this.toResponse(entry)),
      new PageMetaDto({ itemCount, pageOptionsDto: query }),
    );
  }

  private toResponse(entry: AuditLog): AuditLogResponseDto {
    return {
      uuid: entry.uuid,
      createdAt: entry.createdAt,
      action: entry.action,
      actor: {
        type: entry.actorType,
        uuid: entry.actorUuid,
        name: entry.actorName,
      },
      entity: {
        type: entry.entityType,
        uuid: entry.entityUuid,
        label: entry.entityLabel,
      },
      changes: (entry.changes ?? []) as unknown as AuditLogChangeDto[],
      correlationId: entry.correlationId,
    };
  }
}
