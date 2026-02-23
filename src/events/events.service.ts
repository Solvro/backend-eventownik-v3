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

  async findAll(query: EventListingDto) {
    // TODO: superadmin wszystko widzi, organizator swoje
    const { skip, take, name, location, sort } = query;

    const where: Prisma.EventWhereInput = {
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
      verifiedAt: { not: null },
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

  async create(eventDto: EventCreateDto, photoUrl: string | null) {
    // TODO: Jak będzie auth to odkomentować łączenie z adminem
    const { links, ...dataWithoutLinks } = eventDto;
    if (
      (await this.prisma.event.findUnique({
        where: { slug: eventDto.slug },
      })) !== null
    ) {
      throw new ConflictException(
        `Event with slug ${eventDto.slug} already exists`,
      );
    }

    const event = await this.prisma.event.create({
      data: {
        ...(dataWithoutLinks as Prisma.EventCreateInput),
        photoUrl,
        // organizerAdmin: {
        //   connect: { uuid: admin.uuid },
        // },
        links: {
          create: links,
        },
      },
      include: {
        links: true,
      },
    });

    return event;
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
        verifiedAt: { not: null },
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
    // TODO: superadmin dowolny, organizator swoje
    const event = await this.prisma.event.findUnique({
      where: { uuid },
    });

    if (event == null) {
      throw new NotFoundException(`Event with UUID ${uuid} not found`);
    }

    if (eventDto.slug !== undefined && eventDto.slug !== event.slug) {
      const same_slug_event = await this.prisma.event.findFirst({
        where: { slug: eventDto.slug, uuid: { not: uuid } },
      });

      if (same_slug_event !== null) {
        throw new ConflictException(
          `Event with slug ${same_slug_event.slug} already exists`,
        );
      }
    }

    const { links, ...dataWithoutLinks } = eventDto;

    return await this.prisma.event.update({
      where: { uuid },
      data: {
        ...dataWithoutLinks,
        photoUrl,
        links: {
          deleteMany: {},
          create: links,
        },
      },
      include: {
        links: true,
      },
    });
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
