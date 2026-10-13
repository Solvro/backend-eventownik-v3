import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import type { Prisma } from "src/generated/prisma/client";
import { TicketMode } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import { Injectable } from "@nestjs/common";

import { TicketParticipantsListingDto } from "./dto/ticket-participants-listing.dto";
import { TicketParticipant } from "./entities/ticket-scan-result.entity";
import {
  collectBlockUuids,
  formatShownAttributes,
} from "./ticket-attribute-format";
import { TicketsService } from "./tickets.service";

@Injectable()
export class TicketParticipantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketsService: TicketsService,
  ) {}

  async findAll(
    eventUuid: string,
    ticketUuid: string,
    query: TicketParticipantsListingDto,
  ): Promise<PageDto<TicketParticipant>> {
    const { blockUuid, confirmed, search } = query;
    const ticket = await this.ticketsService.findForBlockContext(
      eventUuid,
      ticketUuid,
      blockUuid,
    );

    const checkInScope = { ticketUuid, blockUuid: blockUuid ?? null };

    const conditions: Prisma.ParticipantWhereInput[] = [];
    if (ticket.mode === TicketMode.BLOCK && blockUuid !== undefined) {
      conditions.push({
        attributes: {
          some: {
            attributeUuid: ticket.attributeUuid ?? undefined,
            OR: [
              { value: { array_contains: blockUuid } },
              { value: { equals: blockUuid } },
            ],
          },
        },
      });
    }
    if (confirmed === true) {
      conditions.push({ ticketCheckIns: { some: checkInScope } });
    }
    if (confirmed === false) {
      conditions.push({ ticketCheckIns: { none: checkInScope } });
    }
    if (search !== undefined && search !== "") {
      conditions.push({ email: { contains: search, mode: "insensitive" } });
    }

    const where: Prisma.ParticipantWhereInput = {
      eventUuid,
      AND: conditions,
    };

    const shownAttributeUuids = ticket.attributes.map(
      (attribute) => attribute.attributeUuid,
    );

    const [itemCount, participants, shownAttributes] =
      await this.prisma.$transaction([
        this.prisma.participant.count({ where }),
        this.prisma.participant.findMany({
          where,
          skip: query.skip,
          take: query.take,
          orderBy: { email: "asc" },
          select: {
            uuid: true,
            email: true,
            attributes: {
              where: { attributeUuid: { in: shownAttributeUuids } },
              select: { attributeUuid: true, value: true },
            },
            ticketCheckIns: {
              where: checkInScope,
              select: { confirmedAt: true },
            },
          },
        }),
        this.prisma.attribute.findMany({
          where: { uuid: { in: shownAttributeUuids } },
          select: { uuid: true, name: true, type: true },
          orderBy: { order: "asc" },
        }),
      ]);

    const valueOfFor =
      (participant: (typeof participants)[number]) =>
      (attributeUuid: string): Prisma.JsonValue =>
        participant.attributes.find(
          (item) => item.attributeUuid === attributeUuid,
        )?.value ?? null;

    const blockUuids = [
      ...new Set(
        participants.flatMap((participant) =>
          collectBlockUuids(shownAttributes, valueOfFor(participant)),
        ),
      ),
    ];
    const blocks =
      blockUuids.length === 0
        ? []
        : await this.prisma.block.findMany({
            where: { uuid: { in: blockUuids } },
            select: { uuid: true, name: true },
          });
    const blockNames = new Map(blocks.map((block) => [block.uuid, block.name]));

    const data = participants.map((participant): TicketParticipant => {
      const checkIn = participant.ticketCheckIns.at(0);
      return {
        uuid: participant.uuid,
        email: participant.email,
        attributes: formatShownAttributes(
          shownAttributes,
          valueOfFor(participant),
          blockNames,
        ),
        attendance: {
          confirmed: checkIn !== undefined,
          confirmedAt: checkIn?.confirmedAt ?? null,
        },
      };
    });

    return new PageDto(
      data,
      new PageMetaDto({ itemCount, pageOptionsDto: query }),
    );
  }
}
