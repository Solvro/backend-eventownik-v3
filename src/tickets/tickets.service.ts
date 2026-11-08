import { Prisma } from "src/generated/prisma/client";
import { AttributeType, TicketMode } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { CreateTicketDto } from "./dto/create-ticket.dto";
import { UpdateTicketDto } from "./dto/update-ticket.dto";
import { Ticket } from "./entities/ticket.entity";

const NON_DISPLAYABLE_ATTRIBUTE_TYPES: AttributeType[] = [
  AttributeType.file,
  AttributeType.drawing,
];

const ticketInclude = {
  attributes: { select: { attributeUuid: true } },
} satisfies Prisma.TicketInclude;

type TicketWithAttributes = Prisma.TicketGetPayload<{
  include: typeof ticketInclude;
}>;

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(ticket: TicketWithAttributes): Ticket {
    return {
      uuid: ticket.uuid,
      eventUuid: ticket.eventUuid,
      mode: ticket.mode,
      attributeUuid: ticket.attributeUuid,
      shownAttributeUuids: ticket.attributes.map(
        (attribute) => attribute.attributeUuid,
      ),
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };
  }

  private async checkEventExists(eventUuid: string) {
    const event = await this.prisma.event.findUnique({
      where: { uuid: eventUuid },
      select: { uuid: true },
    });
    if (event === null) {
      throw new NotFoundException(`Event with UUID ${eventUuid} not found`);
    }
  }

  private async validateTargetAttribute(
    eventUuid: string,
    attributeUuid: string,
  ) {
    const attribute = await this.prisma.attribute.findFirst({
      where: { uuid: attributeUuid, eventUuid },
      select: { type: true },
    });
    if (attribute === null) {
      throw new NotFoundException(
        `Attribute with UUID ${attributeUuid} in event ${eventUuid} not found`,
      );
    }
    if (attribute.type !== AttributeType.block) {
      throw new BadRequestException(
        "Tickets of mode BLOCK require an attribute of type block",
      );
    }
  }

  private async validateShownAttributes(
    eventUuid: string,
    attributeUuids: string[],
  ) {
    if (attributeUuids.length === 0) {
      return;
    }

    const attributes = await this.prisma.attribute.findMany({
      where: { uuid: { in: attributeUuids }, eventUuid },
      select: { uuid: true, type: true },
    });

    const foundUuids = new Set(attributes.map((attribute) => attribute.uuid));
    const missing = attributeUuids.filter((uuid) => !foundUuids.has(uuid));
    if (missing.length > 0) {
      throw new NotFoundException(
        `Attributes not found in event ${eventUuid}: ${missing.join(", ")}`,
      );
    }

    const notDisplayable = attributes.filter((attribute) =>
      NON_DISPLAYABLE_ATTRIBUTE_TYPES.includes(attribute.type),
    );
    if (notDisplayable.length > 0) {
      throw new BadRequestException(
        `Attributes of type ${NON_DISPLAYABLE_ATTRIBUTE_TYPES.join(", ")} cannot be shown on a ticket`,
      );
    }
  }

  async create(eventUuid: string, dto: CreateTicketDto): Promise<Ticket> {
    await this.checkEventExists(eventUuid);

    if (dto.mode === TicketMode.EVENT && dto.attributeUuid !== undefined) {
      throw new BadRequestException(
        "Tickets of mode EVENT cannot have an attribute",
      );
    }

    if (dto.mode === TicketMode.BLOCK && dto.attributeUuid !== undefined) {
      await this.validateTargetAttribute(eventUuid, dto.attributeUuid);
    }

    const shownAttributeUuids = dto.shownAttributeUuids ?? [];
    await this.validateShownAttributes(eventUuid, shownAttributeUuids);

    try {
      const ticket = await this.prisma.ticket.create({
        data: {
          eventUuid,
          mode: dto.mode,
          attributeUuid: dto.attributeUuid ?? null,
          attributes: {
            create: shownAttributeUuids.map((attributeUuid) => ({
              attributeUuid,
            })),
          },
        },
        include: ticketInclude,
      });
      return this.toEntity(ticket);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          dto.mode === TicketMode.EVENT
            ? `Event ${eventUuid} already has an event ticket`
            : `Attribute ${dto.attributeUuid ?? ""} already has a ticket`,
        );
      }
      throw error;
    }
  }

  async findAll(eventUuid: string): Promise<Ticket[]> {
    await this.checkEventExists(eventUuid);

    const tickets = await this.prisma.ticket.findMany({
      where: { eventUuid },
      include: ticketInclude,
      orderBy: { createdAt: "asc" },
    });
    return tickets.map((ticket) => this.toEntity(ticket));
  }

  async findOne(eventUuid: string, ticketUuid: string): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { uuid: ticketUuid, eventUuid },
      include: ticketInclude,
    });
    if (ticket === null) {
      throw new NotFoundException(`Ticket with UUID ${ticketUuid} not found`);
    }
    return this.toEntity(ticket);
  }

  async findForBlockContext(
    eventUuid: string,
    ticketUuid: string,
    blockUuid: string | undefined,
  ) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { uuid: ticketUuid, eventUuid },
      include: ticketInclude,
    });
    if (ticket === null) {
      throw new NotFoundException(`Ticket with UUID ${ticketUuid} not found`);
    }

    if (ticket.mode === TicketMode.EVENT && blockUuid !== undefined) {
      throw new BadRequestException(
        "blockUuid must not be provided for an EVENT ticket",
      );
    }
    if (ticket.mode === TicketMode.BLOCK) {
      if (blockUuid === undefined || ticket.attributeUuid === null) {
        throw new BadRequestException(
          "blockUuid is required for a BLOCK ticket",
        );
      }
      const block = await this.prisma.block.findFirst({
        where: { uuid: blockUuid, attributeUuid: ticket.attributeUuid },
        select: { uuid: true },
      });
      if (block === null) {
        throw new NotFoundException(
          `Block with UUID ${blockUuid} not found in the ticket's attribute`,
        );
      }
    }

    return ticket;
  }

  async update(
    eventUuid: string,
    ticketUuid: string,
    dto: UpdateTicketDto,
  ): Promise<Ticket> {
    await this.findOne(eventUuid, ticketUuid);
    await this.validateShownAttributes(eventUuid, dto.shownAttributeUuids);

    const ticket = await this.prisma.$transaction(async (tx) => {
      await tx.ticketAttribute.deleteMany({ where: { ticketUuid } });
      await tx.ticketAttribute.createMany({
        data: dto.shownAttributeUuids.map((attributeUuid) => ({
          ticketUuid,
          attributeUuid,
        })),
      });
      return tx.ticket.update({
        where: { uuid: ticketUuid },
        data: { updatedAt: new Date() },
        include: ticketInclude,
      });
    });
    return this.toEntity(ticket);
  }

  async remove(eventUuid: string, ticketUuid: string): Promise<void> {
    await this.findOne(eventUuid, ticketUuid);
    await this.prisma.ticket.delete({ where: { uuid: ticketUuid } });
  }
}
