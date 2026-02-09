import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import { parseSortInput } from "src/common/utils/prisma.utility";
import { Prisma } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import { Injectable, NotFoundException } from "@nestjs/common";

import { CreateOrganizerDto } from "./dto/create-organizer.dto";
import { OrganizerListingDto } from "./dto/organizer-listing.dto";
import { UpdateOrganizerDto } from "./dto/update-organizer.dto";

@Injectable()
export class OrganizersService {
  constructor(private readonly prisma: PrismaService) {}
  create(createOrganizerDto: CreateOrganizerDto) {
    return "This action adds a new organizer";
  }

  async findAll(eventUuid: string, query: OrganizerListingDto) {
    const event = await this.prisma.event.findUnique({
      where: {
        uuid: eventUuid,
      },
    });
    if (event == null) {
      throw new NotFoundException(`Event with uuid: ${eventUuid} not found`);
    }

    const { skip, take, isActive, sort } = query;
    const where: Prisma.AdminWhereInput = {
      permissions: {
        some: {
          eventUuid,
        },
      },
      ...(isActive === undefined ? {} : { active: isActive }),
    };

    const orderBy = parseSortInput(sort, [
      "createdAt",
      "firstName",
      "lastName",
      "email",
    ]);

    if (orderBy.length === 0) {
      orderBy.push({ createdAt: "desc" });
    }

    const [itemCount, organizers] = await this.prisma.$transaction([
      this.prisma.admin.count({ where }),
      this.prisma.admin.findMany({
        where,
        skip,
        take,
        orderBy,
        select: {
          uuid: true,
          firstName: true,
          lastName: true,
          email: true,
          type: true,
          active: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto: query });
    return new PageDto(organizers, pageMetaDto);
  }

  findOne(id: number) {
    return `This action returns a #${id} organizer`;
  }

  update(id: number, updateOrganizerDto: UpdateOrganizerDto) {
    return `This action updates a #${id} organizer`;
  }

  remove(id: number) {
    return `This action removes a #${id} organizer`;
  }
}
