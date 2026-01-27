import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import { parseSortInput } from "src/common/utils/prisma.utility";
import { Prisma } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import { Injectable, NotFoundException } from "@nestjs/common";

import { EventListingDto } from "./dto/event-listing.dto";

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
      }),
    ]);

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto: query });
    return new PageDto(events, pageMetaDto);
  }

  async findAllPublic(query: EventListingDto) {
    // TODO: where is_public = true and verifiedAt not null
    const { skip, take, name, location, sort } = query;

    const where: Prisma.EventWhereInput = {
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
      }),
    ]);

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto: query });
    return new PageDto(events, pageMetaDto);
  }

  async create(eventDto: Prisma.EventCreateInput) {
    // TODO: zmienić później pozyskiwanie organizerUUID
    const temporaryUUID = "xxxxxxxx-xxxx-xxxx-xxxx-c4eaaf5ca7f9";
    const admin = await this.prisma.admin.findFirst({
      where: { uuid: temporaryUUID },
    });

    if (admin == null) {
      throw new NotFoundException(`Admin with UUID ${temporaryUUID} not found`);
    }

    const event = await this.prisma.event.create({
      data: {
        ...eventDto,
        organizerAdmin: {
          connect: { uuid: admin.uuid },
        },
      },
    });

    return event;
  }

  async findOne(uuid: string) {
    // TODO: superadmin dowolny, organizator swoje
    const event = await this.prisma.event.findUnique({
      where: { uuid },
    });

    if (event == null) {
      throw new NotFoundException(`Event with UUID ${uuid} not found`);
    }

    return event;
  }

  async findOnePublic(uuid: string) {
    const event = await this.prisma.event.findUnique({
      where: {
        uuid,
        // raczej tu dorzucamy jeszcze is_public
        verifiedAt: { not: null },
      },
    });

    if (event == null) {
      throw new NotFoundException(`Event with UUID ${uuid} not found`);
    }

    return event;
  }

  async update(uuid: string, eventDto: Prisma.EventUpdateInput) {
    // TODO: superadmin dowolny, organizator swoje
    const event = await this.prisma.event.findFirst({
      where: { uuid },
    });

    if (event == null) {
      throw new NotFoundException(`Event with UUID ${uuid} not found`);
    }

    const updatedEvent = await this.prisma.event.update({
      where: { uuid },
      data: eventDto,
    });

    return updatedEvent;
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
