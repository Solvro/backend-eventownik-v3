import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import { parseSortInput } from "src/common/utils/prisma.utility";
import { Prisma } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import { Injectable, NotFoundException } from "@nestjs/common";

import { AttributeListingDto } from "./dto/attribute-listing.dto";
import { CreateAttributeDto } from "./dto/create-attribute.dto";
import { UpdateAttributeDto } from "./dto/update-attribute.dto";

@Injectable()
export class AttributesService {
  constructor(private prisma: PrismaService) {}

  async create(createAttributeDto: CreateAttributeDto, eventId: string) {
    return this.prisma.$transaction(async (prisma) => {
      const event = await prisma.event.findUnique({
        where: { uuid: eventId },
      });
      if (event == null) {
        throw new NotFoundException(`Event with uuid ${eventId} not found`);
      }

      return await prisma.attribute.create({
        data: {
          name: createAttributeDto.name,
          options: createAttributeDto.options,
          order: createAttributeDto.order,
          showInList: createAttributeDto.showInList,
          type: createAttributeDto.type,
          eventUuid: event.uuid,
        },
      });
    });
  }

  async findAll(eventId: string, query: AttributeListingDto) {
    const event = await this.prisma.event.findUnique({
      where: { uuid: eventId },
    });
    if (event == null) {
      throw new NotFoundException(`Event with uuid ${eventId} not found`);
    }

    const { skip, take, sort, name, type } = query;
    const where: Prisma.AttributeWhereInput = {
      eventUuid: eventId,
      ...(name === undefined
        ? {}
        : { name: { contains: name, mode: "insensitive" } }),
      ...(type === undefined ? {} : { type: { equals: type } }),
    };
    const orderBy = parseSortInput(sort, [
      "name",
      "type",
      "createdAt",
      "order",
    ]);
    if (orderBy.length === 0) {
      orderBy.push({ createdAt: "desc" });
    }
    const [itemCount, attributes] = await this.prisma.$transaction([
      this.prisma.attribute.count({ where }),
      this.prisma.attribute.findMany({
        where,
        skip,
        take,
        orderBy,
      }),
    ]);
    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto: query });
    return new PageDto(attributes, pageMetaDto);
  }

  async findOne(id: string, eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { uuid: eventId },
    });
    if (event == null) {
      throw new NotFoundException(`Event with uuid ${eventId} not found`);
    }
    const attribute = await this.prisma.attribute.findFirst({
      where: { uuid: id, eventUuid: eventId },
    });
    if (attribute == null) {
      throw new NotFoundException(`Attribute with uuid ${id} not found`);
    }
    return attribute;
  }

  async update(
    id: string,
    eventId: string,
    updateAttributeDto: UpdateAttributeDto,
  ) {
    return this.prisma.$transaction(async (prisma) => {
      const event = await prisma.event.findUnique({
        where: { uuid: eventId },
      });
      if (event == null) {
        throw new NotFoundException(`Event with uuid ${eventId} not found`);
      }

      const foundAttribute = await prisma.attribute.findFirst({
        where: { uuid: id, eventUuid: eventId },
      });
      if (foundAttribute == null) {
        throw new NotFoundException(`Attribute with uuid ${id} not found`);
      }

      return prisma.attribute.update({
        where: { uuid: id, eventUuid: eventId },
        data: {
          name: updateAttributeDto.name,
          options: updateAttributeDto.options,
          order: updateAttributeDto.order,
          showInList: updateAttributeDto.showInList,
          type: updateAttributeDto.type,
        },
      });
    });
  }

  async remove(id: string, eventId: string) {
    return this.prisma.$transaction(async (prisma) => {
      const event = await prisma.event.findUnique({
        where: { uuid: eventId },
      });
      if (event == null) {
        throw new NotFoundException(`Event with uuid ${eventId} not found`);
      }
      const deletedAttribute = await prisma.attribute.deleteMany({
        where: { uuid: id, eventUuid: eventId },
      });
      if (deletedAttribute.count === 0) {
        throw new NotFoundException(`Attribute with uuid ${id} not found`);
      }
      return deletedAttribute;
    });
  }
}
