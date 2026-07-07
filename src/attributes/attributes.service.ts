import { isUUID } from "class-validator";
import { BlocksService } from "src/blocks/blocks.service";
import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import { parseSortInput } from "src/common/utils/prisma.utility";
import {
  Prisma,
  Attribute as PrismaAttribute,
} from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

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

  private getConfigObject(config?: Record<string, unknown>) {
    if (config == null || typeof config !== "object" || Array.isArray(config)) {
      return null;
    }

    return config;
  }

  private getStringArray(config: Record<string, unknown>, key: string) {
    const value = config[key];
    if (!Array.isArray(value)) {
      return null;
    }

    const values = value.filter(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0,
    );
    return values;
  }

  private getPositiveIntegerValue(
    config: Record<string, unknown>,
    key: string,
  ) {
    const value = config[key];
    if (value === undefined) {
      return;
    }

    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(
        `Attribute config field ${key} must be a positive integer.`,
      );
    }

    return value;
  }

  private normalizeConfig(
    type: CreateAttributeDto["type"],
    config?: Record<string, unknown>,
  ): Prisma.InputJsonValue | undefined {
    const configObject = this.getConfigObject(config);

    if (type === "select" || type === "multiSelect") {
      if (configObject == null) {
        throw new BadRequestException(
          `Attribute config is required for ${type} attributes.`,
        );
      }

      const options = this.getStringArray(configObject, "options");
      if (options == null || options.length === 0) {
        throw new BadRequestException(
          `Attribute config for ${type} attributes must contain a non-empty options array.`,
        );
      }

      const normalizedConfig: Record<string, unknown> = {
        options,
      };

      if (typeof configObject.allowOther === "boolean") {
        normalizedConfig.allowOther = configObject.allowOther;
      }

      if (type === "multiSelect") {
        const maxSelections = this.getPositiveIntegerValue(
          configObject,
          "maxSelections",
        );
        if (maxSelections !== undefined) {
          normalizedConfig.maxSelections = maxSelections;
        }
      }

      return normalizedConfig as Prisma.InputJsonValue;
    }

    if (type === "block") {
      const normalizedConfig: Record<string, unknown> = {
        maxSelections: 1,
      };

      if (configObject == null) {
        return normalizedConfig as Prisma.InputJsonValue;
      }

      const maxSelections = this.getPositiveIntegerValue(
        configObject,
        "maxSelections",
      );
      if (maxSelections !== undefined) {
        normalizedConfig.maxSelections = maxSelections;
      }

      if (configObject.participantFields !== undefined) {
        const participantFields = this.getStringArray(
          configObject,
          "participantFields",
        );
        if (participantFields == null) {
          throw new BadRequestException(
            "Attribute config field participantFields must be an array of strings.",
          );
        }

        const normalizedParticipantFields = participantFields.map((field) =>
          field.trim(),
        );

        const invalidParticipantField = normalizedParticipantFields.find(
          (field) => field !== "email" && !isUUID(field),
        );
        if (invalidParticipantField !== undefined) {
          throw new BadRequestException(
            `Attribute config field participantFields contains an invalid value: ${invalidParticipantField}`,
          );
        }

        normalizedConfig.participantFields = normalizedParticipantFields;
      }

      return normalizedConfig as Prisma.InputJsonValue;
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
        config: this.normalizeConfig(
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
        config: this.normalizeConfig(nextType, updateAttributeDto.config),
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
