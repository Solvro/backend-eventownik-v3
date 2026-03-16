import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import { parseSortInput } from "src/common/utils/prisma.utility";
import { Prisma } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { EventCreateDto } from "./dto/event-create.dto";
import { EventListingDto } from "./dto/event-listing.dto";
import { EventUpdateDto } from "./dto/event-update.dto";

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: EventListingDto, eventsIds: string[], userType: string) {
    // TODO: superadmin wszystko widzi, organizator swoje
    const { skip, take, name, location, sort } = query;
    const where: Prisma.EventWhereInput = {
      ...(userType === "superadmin" ? {} : { uuid: { in: eventsIds } }),
      ...(name === undefined
        ? {}
        : { name: { contains: name, mode: "insensitive" } }),
      ...(location === undefined
        ? {}
        : { location: { contains: location, mode: "insensitive" } }),
      // TODO: add more for every filtering options
    };

    const orderBy = parseSortInput(sort, ["name", "location", "createdAt"]);

    if (orderBy.length === 0) {
      orderBy.push({ createdAt: "desc" });
    }

    const [itemCount, events] = await this.prisma.$transaction([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          links: true,
        },
      }),
    ]);

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto: query });
    return new PageDto(events, pageMetaDto);
  }

  async findAllPublic(query: EventListingDto) {
    const { skip, take, name, location, sort } = query;

    const where: Prisma.EventWhereInput = {
      isPublic: true,
      isVerified: true,
      ...(name === undefined
        ? {}
        : { name: { contains: name, mode: "insensitive" } }),
      ...(location === undefined
        ? {}
        : { location: { contains: location, mode: "insensitive" } }),
    };

    const orderBy = parseSortInput(sort, ["name", "location", "createdAt"]);

    if (orderBy.length === 0) {
      orderBy.push({ createdAt: "desc" });
    }

    const [itemCount, events] = await this.prisma.$transaction([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          links: true,
        },
      }),
    ]);

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto: query });
    return new PageDto(events, pageMetaDto);
  }

  async create(
    eventDto: EventCreateDto,
    photoUrl: string | null,
    adminUuid: string,
  ) {
    const { links, ...dataWithoutLinks } = eventDto;

    try {
      const event = await this.prisma.$transaction(async (tx) => {
        const createdEvent = await tx.event.create({
          data: {
            ...(dataWithoutLinks as Prisma.EventCreateInput),
            photoUrl,
            organizerAdmin: {
              connect: { uuid: adminUuid },
            },
            links: {
              create: links,
            },
          },
          include: {
            links: true,
          },
        });

        await tx.eventPermission.create({
          data: {
            event: { connect: { uuid: createdEvent.uuid } },
            admin: { connect: { uuid: adminUuid } },
            permission: "MANAGE_ALL",
          },
        });

        return createdEvent;
      });

      return event;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          `Event with slug ${eventDto.slug} already exists`,
        );
      }
      throw error;
    }
  }

  async findOne(uuid: string) {
    // TODO: superadmin dowolny, organizator swoje
    const event = await this.prisma.event.findUnique({
      where: { uuid },
      include: {
        links: true,
      },
    });

    if (event == null) {
      throw new NotFoundException(`Event with UUID ${uuid} not found`);
    }

    return event;
  }

  async findOnePublic(slug: string) {
    const event = await this.prisma.event.findUnique({
      where: {
        slug,
        isVerified: true,
        isPublic: true,
      },
      include: {
        links: true,
      },
    });

    if (event == null) {
      throw new NotFoundException(`Event with slug ${slug} not found`);
    }

    return event;
  }

  async update(
    uuid: string,
    eventDto: EventUpdateDto,
    photoUrl: string | null,
  ) {
    // TODO: superadmin dowolny, organizator swoj
    const { links, ...dataWithoutLinks } = eventDto;

    try {
      if (links === undefined) {
        return await this.prisma.event.update({
          where: { uuid },
          data: {
            ...dataWithoutLinks,
            photoUrl,
          },
          include: {
            links: true,
          },
        });
      }

      return await this.prisma.$transaction(async (tx) => {
        await tx.eventLink.deleteMany({
          where: { eventUuid: uuid },
        });

        return await tx.event.update({
          where: { uuid },
          data: {
            ...dataWithoutLinks,
            photoUrl,
            ...(links.length === 0 ? {} : { links: { create: links } }),
          },
          include: {
            links: true,
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `Event with slug ${eventDto.slug} already exists`,
        );
      } else if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException(`Event with UUID ${uuid} not found`);
      }
      throw error;
    }
  }

  async remove(uuid: string) {
    // TODO: superadmin dowolny, organizator swoje
    const event = await this.prisma.event.findFirst({
      where: { uuid },
    });

    if (event == null) {
      throw new NotFoundException(`Event with UUID ${uuid} not found`);
    }

    return this.prisma.event.delete({
      where: { uuid },
    });
  }
}
