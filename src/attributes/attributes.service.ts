import { BlocksService } from "src/blocks/blocks.service";
import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import { parseSortInput } from "src/common/utils/prisma.utility";
import {
  Prisma,
  Attribute as PrismaAttribute,
} from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import { Injectable, NotFoundException } from "@nestjs/common";

import { AttributeListingDto } from "./dto/attribute-listing.dto";
import { BulkUpdateAttributeDto } from "./dto/bulk-update-attribute.dto";
import { CreateAttributeDto } from "./dto/create-attribute.dto";
import { UpdateAttributeDto } from "./dto/update-attribute.dto";

@Injectable()
export class AttributesService {
  constructor(
    private prisma: PrismaService,
    private blocksService: BlocksService,
  ) {}

  private sanitizeConfig(
    type: CreateAttributeDto["type"],
    config?: Record<string, unknown>,
  ): Prisma.InputJsonValue | undefined {
    if (config == null || typeof config !== "object" || Array.isArray(config)) {
      return undefined;
    }

    if (type === "select" || type === "multiSelect") {
      const options = Array.isArray(config.options)
        ? config.options.filter(
            (option): option is string =>
              typeof option === "string" && option.trim().length > 0,
          )
        : [];

      const sanitizedConfig: Record<string, unknown> = {
        options,
      };

      if (typeof config.allowOther === "boolean") {
        sanitizedConfig.allowOther = config.allowOther;
      }

      if (type === "multiSelect" && typeof config.maxSelections === "number") {
        sanitizedConfig.maxSelections = config.maxSelections;
      }

      return sanitizedConfig as Prisma.InputJsonValue;
    }

    if (type === "block") {
      const sanitizedConfig: Record<string, unknown> = {};

      if (typeof config.maxSelections === "number") {
        sanitizedConfig.maxSelections = config.maxSelections;
      }

      return sanitizedConfig as Prisma.InputJsonValue;
    }

    return {};
  }

  private async createTx(
    prisma: Prisma.TransactionClient,
    createAttributeDto: CreateAttributeDto,
    eventId: string,
  ) {
    const attribute = await prisma.attribute.create({
      data: {
        name: createAttributeDto.name,
        order: createAttributeDto.order,
        showInList: createAttributeDto.showInList,
        type: createAttributeDto.type,
        eventUuid: eventId,
        config: this.sanitizeConfig(
          createAttributeDto.type,
          createAttributeDto.config,
        ),
      },
    });

    if (attribute.type === "block") {
      await this.blocksService.ensureRootBlock(
        eventId,
        attribute.uuid,
        attribute.name,
        prisma,
      );
    }

    return attribute;
  }

  async create(createAttributeDto: CreateAttributeDto, eventId: string) {
    return this.prisma.$transaction(async (prisma) => {
      const event = await prisma.event.findUnique({
        where: { uuid: eventId },
      });
      if (event == null) {
        throw new NotFoundException(`Event with uuid ${eventId} not found`);
      }

      return this.createTx(prisma, createAttributeDto, eventId);
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

      return this.updateTx(prisma, id, eventId, updateAttributeDto);
    });
  }

  private async updateTx(
    prisma: Prisma.TransactionClient,
    id: string,
    eventId: string,
    updateAttributeDto: UpdateAttributeDto,
  ) {
    const foundAttribute = await prisma.attribute.findFirst({
      where: { uuid: id, eventUuid: eventId },
    });
    if (foundAttribute == null) {
      throw new NotFoundException(`Attribute with uuid ${id} not found`);
    }

    const nextType = updateAttributeDto.type ?? foundAttribute.type;

    const updated = await prisma.attribute.update({
      where: { uuid: id, eventUuid: eventId },
      data: {
        name: updateAttributeDto.name,
        order: updateAttributeDto.order,
        showInList: updateAttributeDto.showInList,
        type: updateAttributeDto.type,
        config: this.sanitizeConfig(nextType, updateAttributeDto.config),
      },
    });

    if (foundAttribute.type !== "block" && nextType === "block") {
      await this.blocksService.ensureRootBlock(
        eventId,
        updated.uuid,
        updated.name,
        prisma,
      );
    }
    if (foundAttribute.type === "block" && nextType !== "block") {
      await this.blocksService.deleteRootBlocks(updated.uuid, prisma);
    }

    if (
      foundAttribute.type === "block" &&
      nextType === "block" &&
      updateAttributeDto.name != null &&
      updateAttributeDto.name !== foundAttribute.name
    ) {
      await prisma.block.updateMany({
        where: { attributeUuid: updated.uuid, isRootBlock: true },
        data: { name: updateAttributeDto.name },
      });
    }

    return updated;
  }

  async remove(id: string, eventId: string) {
    return this.prisma.$transaction(async (prisma) => {
      const event = await prisma.event.findUnique({
        where: { uuid: eventId },
      });
      if (event == null) {
        throw new NotFoundException(`Event with uuid ${eventId} not found`);
      }

      const attribute = await prisma.attribute.findFirst({
        where: { uuid: id, eventUuid: eventId },
        select: { uuid: true },
      });
      if (attribute == null) {
        throw new NotFoundException(`Attribute with uuid ${id} not found`);
      }

      await prisma.block.deleteMany({
        where: { attributeUuid: attribute.uuid },
      });

      return prisma.attribute.deleteMany({
        where: { uuid: id, eventUuid: eventId },
      });
    });
  }

  async bulkUpdate(eventId: string, attributes: BulkUpdateAttributeDto[]) {
    return this.prisma.$transaction(async (prisma) => {
      const event = await prisma.event.findUnique({
        where: { uuid: eventId },
      });
      if (event == null) {
        throw new NotFoundException(`Event with uuid ${eventId} not found`);
      }

      const results: PrismaAttribute[] = [];
      for (const item of attributes) {
        if (item.uuid == null) {
          results.push(
            await this.createTx(prisma, item as CreateAttributeDto, eventId),
          );
        } else {
          results.push(await this.updateTx(prisma, item.uuid, eventId, item));
        }
      }
      return results;
    });
  }
}
