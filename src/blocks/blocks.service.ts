import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import { parseSortInput } from "src/common/utils/prisma.utility";
import { Prisma } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import { Injectable, NotFoundException } from "@nestjs/common";

import { BlockListingDto } from "./dto/block-listing.dto";
import { CreateBlockDto } from "./dto/create-block.dto";
import { UpdateBlockDto } from "./dto/update-block.dto";

@Injectable()
export class BlocksService {
  constructor(private readonly prisma: PrismaService) {}

  private async checkAttributeExists(eventId: string, attributeId: string) {
    const attribute = await this.prisma.attribute.findFirst({
      where: { uuid: attributeId, eventUuid: eventId },
    });

    if (!attribute) {
      throw new NotFoundException(
        `Attribute with UUID ${attributeId} in event ${eventId} not found`,
      );
    }

    return attribute;
  }

  async create(
    eventId: string,
    attributeId: string,
    createBlockDto: CreateBlockDto,
  ) {
    await this.checkAttributeExists(eventId, attributeId);

    return this.prisma.block.create({
      data: {
        ...createBlockDto,
        attributeUuid: attributeId,
      },
    });
  }

  async findAll(eventId: string, attributeId: string, query: BlockListingDto) {
    await this.checkAttributeExists(eventId, attributeId);

    const { skip, take, name, parentUuid, sort } = query;
    const where: Prisma.BlockWhereInput = {
      attributeUuid: attributeId,
      ...(name === undefined
        ? {}
        : { name: { contains: name, mode: "insensitive" } }),
      ...(parentUuid === undefined ? {} : { parentUuid }),
    };

    const orderBy = parseSortInput(sort, ["name", "order", "createdAt"]);

    if (orderBy.length === 0) {
      orderBy.push({ createdAt: "desc" });
    }

    const [itemCount, blocks] = await this.prisma.$transaction([
      this.prisma.block.count({ where }),
      this.prisma.block.findMany({
        where,
        skip,
        take,
        orderBy,
      }),
    ]);

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto: query });
    return new PageDto(blocks, pageMetaDto);
  }

  async findOne(eventId: string, attributeId: string, id: string) {
    const block = await this.prisma.block.findFirst({
      where: {
        uuid: id,
        attributeUuid: attributeId,
        attribute: {
          eventUuid: eventId,
        },
      },
    });

    if (!block) {
      throw new NotFoundException(`Block with UUID ${id} not found`);
    }

    return block;
  }

  async update(
    eventId: string,
    attributeId: string,
    id: string,
    updateBlockDto: UpdateBlockDto,
  ) {
    await this.findOne(eventId, attributeId, id);

    return this.prisma.block.update({
      where: { uuid: id },
      data: updateBlockDto,
    });
  }

  async remove(eventId: string, attributeId: string, id: string) {
    await this.findOne(eventId, attributeId, id);

    await this.prisma.block.delete({
      where: { uuid: id },
    });
  }
}
