import { EmailStatus, Prisma } from "@prisma/client";

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import type { CreateParticipantDto } from "./dto/create-participant.dto";
import type { QueryParticipantDto } from "./dto/query-participant.dto";
import type { UpdateParticipantDto } from "./dto/update-participant.dto";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function toPositiveInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSortDirection(v: unknown): v is "asc" | "desc" {
  return v === "asc" || v === "desc";
}

function mapSortField(
  field: string,
): keyof Prisma.ParticipantOrderByWithRelationInput {
  if (field === "email") {
    return "email";
  }
  if (field === "updated_at") {
    return "updatedAt";
  }
  if (field === "created_at") {
    return "createdAt";
  }
  return "createdAt";
}

type ParticipantWithRelations = Prisma.ParticipantGetPayload<{
  include: { attributes: { include: { attribute: true } }; emails: true };
}>;

@Injectable()
export class ParticipantService {
  constructor(private readonly prisma: PrismaService) {}

  async create(eventUuid: string, dto: CreateParticipantDto) {
    const created = await this.prisma.participant.create({
      data: { email: dto.email, eventUuid },
    });

    const withRelations = await this.prisma.participant.findUnique({
      where: { uuid: created.uuid },
      include: {
        attributes: { include: { attribute: true } },
        emails: true,
      },
    });

    return this.shapeParticipant(withRelations as ParticipantWithRelations);
  }

  async show(eventUuid: string, query: QueryParticipantDto) {
    const { where, orderBy, skip, perPage, page } = this.buildListQuery(
      eventUuid,
      query,
    );

    const [total, items] = await this.prisma.$transaction([
      this.prisma.participant.count({ where }),
      this.prisma.participant.findMany({
        where,
        orderBy,
        skip,
        take: perPage,
        include: {
          attributes: { include: { attribute: true } },
          emails: true,
        },
      }),
    ]);

    return {
      data: items.map((p) => this.shapeParticipant(p)),
      metadata: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    };
  }

  async index(eventUuid: string, uuid: string) {
    const participant = await this.prisma.participant.findFirst({
      where: { uuid, eventUuid },
      include: {
        attributes: { include: { attribute: true } },
        emails: true,
      },
    });

    if (participant === null) {
      throw new NotFoundException("Participant not found");
    }

    return this.shapeParticipant(participant);
  }

  async update(eventUuid: string, uuid: string, dto: UpdateParticipantDto) {
    const exists = await this.prisma.participant.findFirst({
      where: { uuid, eventUuid },
      select: { uuid: true },
    });
    if (exists === null) {
      throw new NotFoundException("Participant not found");
    }

    await this.prisma.participant.update({
      where: { uuid },
      data: { email: dto.email },
    });

    const participant = await this.prisma.participant.findUnique({
      where: { uuid },
      include: {
        attributes: { include: { attribute: true } },
        emails: true,
      },
    });

    if (participant === null || participant.eventUuid !== eventUuid) {
      throw new ForbiddenException("Participant not available for this event");
    }

    return this.shapeParticipant(participant);
  }

  async remove(eventUuid: string, uuid: string) {
    const deleteResult = await this.prisma.participant.deleteMany({
      where: { uuid, eventUuid },
    });

    if (deleteResult.count === 0) {
      throw new NotFoundException("Participant not found");
    }
  }

  private shapeParticipant(p: ParticipantWithRelations) {
    const flattenedAttributes = p.attributes.reduce<Record<string, string>>(
      (accumulator, current) => {
        const attributeName = current.attribute.name;
        const attributeUuid = current.attribute.uuid;

        let attributeKey = "";
        if (isNonEmptyString(attributeName)) {
          attributeKey = attributeName;
        } else if (isNonEmptyString(attributeUuid)) {
          attributeKey = attributeUuid;
        }

        if (attributeKey.length > 0) {
          accumulator[attributeKey] = current.value ?? "";
        }
        return accumulator;
      },
      {},
    );

    const emailsPending = p.emails.filter(
      (email) => email.status === EmailStatus.pending,
    ).length;
    const emailsSent = p.emails.filter(
      (email) => email.status === EmailStatus.sent,
    ).length;
    const emailsFailed = p.emails.filter(
      (email) => email.status === EmailStatus.failed,
    ).length;

    return {
      uuid: p.uuid,
      email: p.email,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
      attributes: flattenedAttributes,
      emails_pending: emailsPending,
      emails_sent: emailsSent,
      emails_failed: emailsFailed,
    };
  }

  private buildListQuery(
    eventUuid: string,
    query: QueryParticipantDto,
  ): {
    where: Prisma.ParticipantWhereInput;
    orderBy: Prisma.Enumerable<Prisma.ParticipantOrderByWithRelationInput>;
    skip: number;
    perPage: number;
    page: number;
  } {
    const page = toPositiveInt((query as { page?: unknown }).page, 1);
    const perPage =
      toPositiveInt((query as { perPage?: unknown }).perPage, 25) || 25;
    const skip = (page - 1) * perPage;

    const sortUnknown: unknown = (query as { sort?: unknown }).sort;
    const sortObject: Record<string, unknown> = isRecord(sortUnknown)
      ? sortUnknown
      : {};

    const orderBy = this.buildOrderBy(sortObject);

    const filterUnknown: unknown = (query as { filter?: unknown }).filter;
    const filterObject: Record<string, unknown> = isRecord(filterUnknown)
      ? filterUnknown
      : {};

    const searchUnknown: unknown = (query as { search?: unknown }).search;
    const where: Prisma.ParticipantWhereInput = { eventUuid };

    const filterEmail = filterObject.email;
    if (isNonEmptyString(filterEmail)) {
      where.email = { contains: filterEmail, mode: "insensitive" };
    }

    if (isNonEmptyString(searchUnknown)) {
      where.OR = [{ email: { contains: searchUnknown, mode: "insensitive" } }];
    }

    return { where, orderBy, skip, perPage, page };
  }

  private buildOrderBy(
    sortObject: Record<string, unknown>,
  ): Prisma.Enumerable<Prisma.ParticipantOrderByWithRelationInput> {
    const entries: [string, "asc" | "desc"][] = Object.entries(
      sortObject,
    ).filter(([, value]) => isSortDirection(value)) as [
      string,
      "asc" | "desc",
    ][];

    if (entries.length === 0) {
      return [{ createdAt: "desc" }];
    }

    const mapped = entries.map(([field, direction]) => {
      const prismaField = mapSortField(field);

      if (prismaField === "email") {
        return { email: direction };
      }
      if (prismaField === "updatedAt") {
        return { updatedAt: direction };
      }
      return { createdAt: direction };
    });

    return mapped;
  }
}
