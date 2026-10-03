import { Prisma } from "src/generated/prisma/client";
import { AttributeType, TicketMode } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";

import { TicketScanDto } from "./dto/ticket-scan.dto";
import {
  TicketCheckIn,
  TicketScanAttribute,
  TicketScanResult,
  TicketScanStatus,
} from "./entities/ticket-scan-result.entity";

function toStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

@Injectable()
export class TicketScanService {
  constructor(private readonly prisma: PrismaService) {}

  private async blockNamesFor(
    blockUuids: string[],
    attributeUuid?: string,
  ): Promise<Map<string, string>> {
    if (blockUuids.length === 0) {
      return new Map();
    }
    const blocks = await this.prisma.block.findMany({
      where: {
        uuid: { in: blockUuids },
        ...(attributeUuid === undefined ? {} : { attributeUuid }),
      },
      select: { uuid: true, name: true },
    });
    return new Map(blocks.map((block) => [block.uuid, block.name]));
  }

  private async evaluate(
    eventUuid: string,
    ticketUuid: string,
    dto: TicketScanDto,
  ): Promise<TicketScanResult> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { uuid: ticketUuid, eventUuid },
      include: { attributes: { select: { attributeUuid: true } } },
    });
    if (ticket === null) {
      throw new NotFoundException(`Ticket with UUID ${ticketUuid} not found`);
    }

    if (ticket.mode === TicketMode.EVENT && dto.blockUuid !== undefined) {
      throw new BadRequestException(
        "blockUuid must not be provided for an EVENT ticket",
      );
    }
    if (ticket.mode === TicketMode.BLOCK) {
      if (dto.blockUuid === undefined || ticket.attributeUuid === null) {
        throw new BadRequestException(
          "blockUuid is required for a BLOCK ticket",
        );
      }
      const block = await this.prisma.block.findFirst({
        where: { uuid: dto.blockUuid, attributeUuid: ticket.attributeUuid },
        select: { uuid: true },
      });
      if (block === null) {
        throw new NotFoundException(
          `Block with UUID ${dto.blockUuid} not found in the ticket's attribute`,
        );
      }
    }

    const shownAttributeUuids = ticket.attributes.map(
      (attribute) => attribute.attributeUuid,
    );
    const neededAttributeUuids = [
      ...shownAttributeUuids,
      ...(ticket.attributeUuid === null ? [] : [ticket.attributeUuid]),
    ];

    const participant = await this.prisma.participant.findUnique({
      where: { ticketToken: dto.token },
      select: {
        uuid: true,
        email: true,
        eventUuid: true,
        attributes: {
          where: { attributeUuid: { in: neededAttributeUuids } },
          select: { attributeUuid: true, value: true },
        },
      },
    });

    if (participant === null) {
      return { status: TicketScanStatus.INVALID_TICKET };
    }
    if (participant.eventUuid !== eventUuid) {
      return { status: TicketScanStatus.WRONG_EVENT };
    }

    const valueOf = (attributeUuid: string) =>
      participant.attributes.find(
        (item) => item.attributeUuid === attributeUuid,
      )?.value ?? null;

    if (ticket.mode === TicketMode.BLOCK && ticket.attributeUuid !== null) {
      const participantBlocks = toStringArray(valueOf(ticket.attributeUuid));
      if (
        dto.blockUuid === undefined ||
        !participantBlocks.includes(dto.blockUuid)
      ) {
        const names = await this.blockNamesFor(
          participantBlocks,
          ticket.attributeUuid,
        );
        return {
          status: TicketScanStatus.WRONG_BLOCK,
          blockNames: participantBlocks
            .map((uuid) => names.get(uuid))
            .filter((name): name is string => name !== undefined),
        };
      }
    }

    const checkIn = await this.prisma.ticketCheckIn.findFirst({
      where: {
        ticketUuid,
        participantUuid: participant.uuid,
        blockUuid: dto.blockUuid ?? null,
      },
      select: { confirmedAt: true },
    });

    const attributes = await this.buildShownAttributes(
      shownAttributeUuids,
      valueOf,
    );

    return {
      status:
        checkIn === null
          ? TicketScanStatus.VALID
          : TicketScanStatus.ALREADY_CONFIRMED,
      participant: { uuid: participant.uuid, email: participant.email },
      attributes,
      ...(checkIn === null ? {} : { confirmedAt: checkIn.confirmedAt }),
    };
  }

  private async buildShownAttributes(
    shownAttributeUuids: string[],
    valueOf: (attributeUuid: string) => Prisma.JsonValue,
  ): Promise<TicketScanAttribute[]> {
    if (shownAttributeUuids.length === 0) {
      return [];
    }

    const attributes = await this.prisma.attribute.findMany({
      where: { uuid: { in: shownAttributeUuids } },
      select: { uuid: true, name: true, type: true },
      orderBy: { order: "asc" },
    });

    const blockUuids = attributes
      .filter((attribute) => attribute.type === AttributeType.block)
      .flatMap((attribute) => toStringArray(valueOf(attribute.uuid)));
    const blockNames = await this.blockNamesFor(blockUuids);

    return attributes.map((attribute) => {
      const value = valueOf(attribute.uuid);
      return {
        attributeUuid: attribute.uuid,
        name: attribute.name,
        type: attribute.type,
        value,
        ...(attribute.type === AttributeType.block
          ? {
              blockNames: toStringArray(value)
                .map((uuid) => blockNames.get(uuid))
                .filter((name): name is string => name !== undefined),
            }
          : {}),
      };
    });
  }

  async scan(
    eventUuid: string,
    ticketUuid: string,
    dto: TicketScanDto,
  ): Promise<TicketScanResult> {
    return this.evaluate(eventUuid, ticketUuid, dto);
  }

  async confirm(
    eventUuid: string,
    ticketUuid: string,
    dto: TicketScanDto,
    adminUuid: string,
  ): Promise<TicketCheckIn> {
    const result = await this.evaluate(eventUuid, ticketUuid, dto);

    if (result.status === TicketScanStatus.ALREADY_CONFIRMED) {
      throw new ConflictException({
        status: result.status,
        message: "Ticket already confirmed",
      });
    }
    if (result.status !== TicketScanStatus.VALID) {
      throw new UnprocessableEntityException({
        status: result.status,
        message: "Ticket cannot be confirmed",
      });
    }

    const participantUuid = result.participant?.uuid;
    if (participantUuid === undefined) {
      throw new UnprocessableEntityException({
        status: TicketScanStatus.INVALID_TICKET,
        message: "Ticket cannot be confirmed",
      });
    }

    try {
      const checkIn = await this.prisma.ticketCheckIn.create({
        data: {
          ticketUuid,
          participantUuid,
          blockUuid: dto.blockUuid ?? null,
          confirmedByAdminUuid: adminUuid,
        },
      });
      return {
        uuid: checkIn.uuid,
        ticketUuid: checkIn.ticketUuid,
        participantUuid: checkIn.participantUuid,
        blockUuid: checkIn.blockUuid,
        confirmedAt: checkIn.confirmedAt,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException({
          status: TicketScanStatus.ALREADY_CONFIRMED,
          message: "Ticket already confirmed",
        });
      }
      throw error;
    }
  }
}
