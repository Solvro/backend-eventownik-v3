import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import {
  Attribute,
  AttributeType,
  EmailTemplate,
  ParticipantAttribute,
  ParticipantEmailStatus,
  Prisma,
  Participant as PrismaParticipant,
} from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { StorageService } from "src/storage/storage.service";

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  ParticipantAttributeDto,
  ParticipantCreateDto,
} from "./dto/participant-create.dto";
import { ParticipantListingDto } from "./dto/participant-listing.dto";
import { ParticipantUpdateDto } from "./dto/participant-update.dto";
import { Participant } from "./entities/participant.entity";

type ParticipantWithRelations = PrismaParticipant & {
  attributes?: (ParticipantAttribute & {
    attribute?: Attribute;
  })[];
  emails?: (ParticipantEmailStatus & {
    email?: EmailTemplate | null;
  })[];
};

@Injectable()
export class ParticipantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  private getStringConfigValues(
    config: Prisma.JsonValue | null,
    key: string,
  ): string[] {
    if (config == null || typeof config !== "object" || Array.isArray(config)) {
      return [];
    }

    const values = (config as Record<string, unknown>)[key];
    if (!Array.isArray(values)) {
      return [];
    }

    return values.filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    );
  }

  private getBooleanConfigValue(
    config: Prisma.JsonValue | null,
    key: string,
  ): boolean {
    if (config == null || typeof config !== "object" || Array.isArray(config)) {
      return false;
    }

    return (config as Record<string, unknown>)[key] === true;
  }

  private async normalizeParticipantAttributeValue(
    eventUuid: string,
    attribute: {
      attributeUuid: string;
      type: AttributeType;
      config: Prisma.JsonValue | null;
    },
    value: unknown,
  ): Promise<Prisma.InputJsonValue | typeof Prisma.JsonNull> {
    if (attribute.type === AttributeType.select) {
      if (value == null || value === "") {
        return Prisma.JsonNull;
      }
      if (typeof value !== "string") {
        throw new BadRequestException(
          `Attribute ${attribute.attributeUuid} must be a string value.`,
        );
      }

      const options = this.getStringConfigValues(attribute.config, "options");
      const allowOther = this.getBooleanConfigValue(
        attribute.config,
        "allowOther",
      );
      if (!allowOther && options.length > 0 && !options.includes(value)) {
        throw new BadRequestException(
          `Invalid value for attribute ${attribute.attributeUuid}. Allowed values are: ${options.join(", ")}`,
        );
      }

      return value;
    }

    if (attribute.type === AttributeType.multiSelect) {
      if (value == null || value === "") {
        return Prisma.JsonNull;
      }

      const rawValues = Array.isArray(value)
        ? value
        : typeof value === "string"
          ? value.split(";")
          : null;

      if (rawValues == null) {
        throw new BadRequestException(
          `Attribute ${attribute.attributeUuid} must be a string array or a semicolon-separated string.`,
        );
      }

      const normalizedValues = rawValues.map((item) => {
        if (typeof item !== "string") {
          throw new BadRequestException(
            `Attribute ${attribute.attributeUuid} must contain only string values.`,
          );
        }
        return item.trim();
      });

      if (normalizedValues.some((item) => item.length === 0)) {
        throw new BadRequestException(
          `Attribute ${attribute.attributeUuid} cannot contain empty values.`,
        );
      }

      const options = this.getStringConfigValues(attribute.config, "options");
      const allowOther = this.getBooleanConfigValue(
        attribute.config,
        "allowOther",
      );
      if (!allowOther && options.length > 0) {
        const invalidValue = normalizedValues.find(
          (item) => !options.includes(item),
        );
        if (invalidValue !== undefined) {
          throw new BadRequestException(
            `Invalid value for attribute ${attribute.attributeUuid}. Allowed values are: ${options.join(", ")}`,
          );
        }
      }

      return normalizedValues;
    }

    if (attribute.type === AttributeType.block) {
      if (
        value == null ||
        value === "null" ||
        value === "" ||
        (Array.isArray(value) && value.length === 0)
      ) {
        return Prisma.JsonNull;
      }

      const rawValues = Array.isArray(value)
        ? value
        : typeof value === "string"
          ? value.split(";")
          : null;

      if (rawValues == null) {
        throw new BadRequestException(
          `Attribute ${attribute.attributeUuid} must be an array of block UUIDs.`,
        );
      }

      const normalizedValues = rawValues.map((item) => {
        if (typeof item !== "string") {
          throw new BadRequestException(
            `Attribute ${attribute.attributeUuid} must contain only string values.`,
          );
        }
        return item.trim();
      });

      if (normalizedValues.length === 0) {
        return Prisma.JsonNull;
      }

      const blocksCount = await this.prisma.block.count({
        where: {
          uuid: { in: normalizedValues },
          attribute: { eventUuid },
        },
      });

      if (blocksCount !== normalizedValues.length) {
        throw new BadRequestException(
          `One or more block UUIDs are invalid or do not exist for attribute ${attribute.attributeUuid}.`,
        );
      }

      const configObject =
        attribute.config != null &&
        typeof attribute.config === "object" &&
        !Array.isArray(attribute.config)
          ? (attribute.config as Record<string, unknown>)
          : null;

      const maxSelections =
        configObject?.maxSelections !== undefined &&
        typeof configObject.maxSelections === "number" &&
        Number.isInteger(configObject.maxSelections) &&
        configObject.maxSelections > 0
          ? configObject.maxSelections
          : 1;

      if (normalizedValues.length > maxSelections) {
        throw new BadRequestException(
          `Attribute ${attribute.attributeUuid} cannot contain more than ${String(maxSelections)} selections.`,
        );
      }

      return normalizedValues;
    }

    if (attribute.type === AttributeType.number) {
      if (value == null || value === "") {
        return Prisma.JsonNull;
      }

      const parsedValue =
        typeof value === "number"
          ? value
          : typeof value === "string"
            ? Number(value)
            : Number.NaN;

      if (Number.isNaN(parsedValue)) {
        throw new BadRequestException(
          `Attribute ${attribute.attributeUuid} must be a valid number.`,
        );
      }

      return parsedValue;
    }

    if (
      attribute.type === AttributeType.date ||
      attribute.type === AttributeType.datetime
    ) {
      if (value == null || value === "") {
        return Prisma.JsonNull;
      }

      const normalizedValue =
        value instanceof Date
          ? value.toISOString()
          : typeof value === "string"
            ? value
            : null;

      if (
        normalizedValue == null ||
        Number.isNaN(Date.parse(normalizedValue))
      ) {
        throw new BadRequestException(
          `Attribute ${attribute.attributeUuid} must be a valid date/time format.`,
        );
      }

      return normalizedValue;
    }

    if (attribute.type === AttributeType.checkbox) {
      if (value == null || value === "") {
        return Prisma.JsonNull;
      }

      if (typeof value === "boolean") {
        return value;
      }

      if (typeof value === "number") {
        if (value === 1) {
          return true;
        }
        if (value === 0) {
          return false;
        }
      }

      if (typeof value === "string") {
        const normalizedValue = value.toLowerCase();
        if (["true", "1", "on"].includes(normalizedValue)) {
          return true;
        }
        if (["false", "0", "off"].includes(normalizedValue)) {
          return false;
        }
      }

      throw new BadRequestException(
        `Attribute ${attribute.attributeUuid} must be a boolean value.`,
      );
    }

    if (value == null || value === "") {
      return Prisma.JsonNull;
    }

    if (typeof value === "string") {
      return value;
    }

    throw new BadRequestException(
      `Attribute ${attribute.attributeUuid} must be a string value.`,
    );
  }

  private mapToEntity(participant: ParticipantWithRelations): Participant {
    return {
      uuid: participant.uuid,
      email: participant.email,
      createdAt: participant.createdAt,
      attributes:
        participant.attributes?.map((attribute) => ({
          uuid: attribute.attributeUuid,
          name: attribute.attribute?.name ?? "",
          value: attribute.value,
          createdAt: attribute.createdAt,
          updatedAt: attribute.updatedAt,
        })) ?? [],
      emails: participant.emails?.map((emailStatus) => ({
        uuid: emailStatus.uuid,
        status: emailStatus.status,
        sendAt: emailStatus.sendAt,
        sendBy: emailStatus.sendBy,
        name: emailStatus.email?.name,
        content: emailStatus.email?.content,
        trigger: emailStatus.email?.trigger,
        triggerConfig: emailStatus.email?.triggerConfig,
      })),
    };
  }

  private async prepareAttributesForSave(
    eventUuid: string,
    participantAttributes?: ParticipantAttributeDto[],
  ): Promise<
    Prisma.ParticipantAttributeUncheckedCreateWithoutParticipantInput[]
  > {
    if (participantAttributes == null || participantAttributes.length === 0) {
      return [];
    }

    const attributeUuids = participantAttributes.map(
      (attribute) => attribute.attributeUuid,
    );
    const eventAttributes = await this.prisma.attribute.findMany({
      where: {
        uuid: { in: attributeUuids },
        eventUuid,
      },
      select: { uuid: true, type: true, config: true },
    });

    const validAttributeMap = new Map<
      string,
      {
        type: AttributeType;
        config: Prisma.JsonValue | null;
      }
    >();
    for (const attribute of eventAttributes) {
      validAttributeMap.set(attribute.uuid, {
        type: attribute.type,
        config: attribute.config,
      });
    }

    const transformedAttributes: Prisma.ParticipantAttributeUncheckedCreateWithoutParticipantInput[] =
      [];

    for (const attribute of participantAttributes) {
      const matchingAttribute = validAttributeMap.get(attribute.attributeUuid);
      if (matchingAttribute == null) {
        continue;
      }

      const valueToSave = await this.normalizeParticipantAttributeValue(
        eventUuid,
        {
          attributeUuid: attribute.attributeUuid,
          type: matchingAttribute.type,
          config: matchingAttribute.config,
        },
        attribute.value,
      );

      // TODO: Integrate EmailService for attribute_changed trigger
      // EmailService.sendOnTrigger(event, participant, "attribute_changed", attr.attributeUuid, valueToSave);

      transformedAttributes.push({
        attributeUuid: attribute.attributeUuid,
        value: valueToSave,
      });
    }

    return transformedAttributes;
  }

  async create(
    eventUuid: string,
    createDto: ParticipantCreateDto,
  ): Promise<Participant> {
    return this.register(
      eventUuid,
      createDto.email,
      createDto.participantAttributes,
    );
  }

  async register(
    eventUuid: string,
    email: string,
    participantAttributes?: ParticipantAttributeDto[],
  ): Promise<Participant> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const event = await tx.event.findUnique({ where: { uuid: eventUuid } });
        if (event == null) {
          throw new NotFoundException(`Event NOT FOUND`);
        }

        const attributesToCreate = await this.prepareAttributesForSave(
          eventUuid,
          participantAttributes,
        );

        const participant = await tx.participant.create({
          data: {
            email,
            eventUuid,
            attributes: {
              create: attributesToCreate,
            },
          },
          include: {
            attributes: {
              include: { attribute: true },
            },
          },
        });

        // TODO: Integrate EmailService -> trigger 'participant_registered'

        return this.mapToEntity(participant);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "Participant with this email already exists in this event.",
        );
      }
      throw error;
    }
  }

  async update(
    eventUuid: string,
    participantUuid: string,
    updateDto: ParticipantUpdateDto,
  ): Promise<Participant> {
    const { participantAttributes, ...updates } = updateDto;

    const participant = await this.prisma.participant.findUnique({
      where: { uuid: participantUuid },
    });

    if (participant?.eventUuid !== eventUuid) {
      throw new NotFoundException("Participant not found in this event");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const dataToUpdate: Prisma.ParticipantUpdateInput = { ...updates };

        if (participantAttributes !== undefined) {
          const attributesToSave = await this.prepareAttributesForSave(
            eventUuid,
            participantAttributes,
          );

          const attributeUuidsToUpdate = attributesToSave.map(
            (a) => a.attributeUuid,
          );

          if (attributeUuidsToUpdate.length > 0) {
            const existingFileAttributes =
              await tx.participantAttribute.findMany({
                where: {
                  participantUuid,
                  attributeUuid: { in: attributeUuidsToUpdate },
                  attribute: { type: AttributeType.file },
                },
              });

            await tx.participantAttribute.deleteMany({
              where: {
                participantUuid,
                attributeUuid: { in: attributeUuidsToUpdate },
              },
            });

            const bucket =
              this.configService.getOrThrow<string>("S3_BUCKET_FORMS");
            for (const attribute of existingFileAttributes) {
              if (
                typeof attribute.value === "string" &&
                attribute.value.length > 0
              ) {
                await this.storageService.delete(bucket, attribute.value);
              }
            }
          }

          dataToUpdate.attributes = {
            create: attributesToSave,
          };
        }

        const updatedParticipant = await tx.participant.update({
          where: { uuid: participantUuid },
          data: dataToUpdate,
          include: {
            attributes: {
              include: { attribute: true },
            },
          },
        });

        return this.mapToEntity(updatedParticipant);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "Participant with this email already exists in this event.",
        );
      }
      throw error;
    }
  }

  async remove(eventUuid: string, participantUuid: string) {
    const participant = await this.prisma.participant.findFirst({
      where: { uuid: participantUuid, eventUuid },
      include: {
        attributes: {
          where: { attribute: { type: AttributeType.file } },
        },
      },
    });

    if (participant == null) {
      throw new NotFoundException("Participant not found");
    }

    // TODO: Integrate EmailService.sendOnTrigger(event, participant, "participant_deleted");

    await this.prisma.participant.delete({
      where: { uuid: participantUuid },
    });

    const bucket = this.configService.getOrThrow<string>("S3_BUCKET_FORMS");
    for (const attribute of participant.attributes) {
      if (typeof attribute.value === "string" && attribute.value.length > 0) {
        await this.storageService.delete(bucket, attribute.value);
      }
    }
  }

  async removeMany(eventUuid: string, participantsToUnregisterIds: string[]) {
    // TODO: Send emails for each unregister (requires fetching emails or moving logic to a job)

    const participants = await this.prisma.participant.findMany({
      where: { uuid: { in: participantsToUnregisterIds }, eventUuid },
      include: {
        attributes: {
          where: { attribute: { type: AttributeType.file } },
        },
      },
    });

    await this.prisma.participant.deleteMany({
      where: {
        uuid: { in: participantsToUnregisterIds },
        eventUuid,
      },
    });

    const bucket = this.configService.getOrThrow<string>("S3_BUCKET_FORMS");
    for (const participant of participants) {
      for (const attribute of participant.attributes) {
        if (typeof attribute.value === "string" && attribute.value.length > 0) {
          await this.storageService.delete(bucket, attribute.value);
        }
      }
    }
  }

  async findAll(
    eventUuid: string,
    query: ParticipantListingDto,
  ): Promise<PageDto<Participant>> {
    const { skip, take, bonusAttributes: bonus_attributes, filters } = query;

    let filterQuery: Prisma.ParticipantWhereInput = {};
    if (filters != null) {
      if (typeof filters === "string" && filters.length > 2000) {
        throw new BadRequestException("Filters string is too long");
      }

      try {
        const parsedFilters: unknown =
          typeof filters === "string" ? JSON.parse(filters) : filters;

        if (typeof parsedFilters === "object" && parsedFilters != null) {
          filterQuery = {
            AND: Object.entries(parsedFilters as Record<string, unknown>)
              .filter(([uuid]) =>
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                  uuid,
                ),
              )
              .map(([attributeUuid, value]) => ({
                attributes: {
                  some: {
                    attributeUuid,
                    value: {
                      equals: value as Prisma.InputJsonValue,
                    },
                  },
                },
              })),
          };
        }
      } catch {
        throw new BadRequestException("Invalid filters JSON");
      }
    }

    const where: Prisma.ParticipantWhereInput = {
      eventUuid,
      ...filterQuery,
    };

    const bonusAttributesArray =
      bonus_attributes == null ? [] : bonus_attributes.split(",");

    const [itemCount, participants] = await this.prisma.$transaction([
      this.prisma.participant.count({ where }),
      this.prisma.participant.findMany({
        where,
        skip,
        take,
        orderBy: { email: "asc" },
        include: {
          attributes: {
            where: {
              attribute: {
                OR: [
                  { showInList: true },
                  { type: "block" },
                  ...(bonusAttributesArray.length > 0
                    ? [{ uuid: { in: bonusAttributesArray } }]
                    : []),
                ],
              },
            },
            include: { attribute: true },
          },
        },
      }),
    ]);

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto: query });

    const data = participants.map((participant) =>
      this.mapToEntity(participant),
    );

    return new PageDto(data, pageMetaDto);
  }

  async findOne(
    eventUuid: string,
    participantUuid: string,
  ): Promise<Participant> {
    const participant = await this.prisma.participant.findFirst({
      where: { uuid: participantUuid, eventUuid },
      include: {
        attributes: {
          include: { attribute: true },
        },
        emails: {
          include: { email: true },
        },
      },
    });

    if (participant == null) {
      throw new NotFoundException("Participant not found");
    }

    return this.mapToEntity(participant);
  }

  async findOnePublic(
    eventUuid: string,
    participantUuid: string,
    attributes: string[],
  ) {
    const participant = await this.prisma.participant.findFirst({
      where: {
        uuid: participantUuid,
        eventUuid,
      },
      include: {
        attributes: {
          where: {
            attribute: { showInList: true },
            attributeUuid: {
              in: attributes.length > 0 ? attributes : undefined,
            },
          },
          include: {
            attribute: {},
          },
        },
      },
    });

    if (participant == null) {
      throw new NotFoundException("Participant not found");
    }

    return participant;
  }

  async bulkUpdateAttributes(
    eventUuid: string,
    attributeUuid: string,
    newValue: string,
    participantIds: string[],
  ) {
    // Verify event and attribute
    const attribute = await this.prisma.attribute.findUnique({
      where: { uuid: attributeUuid },
    });

    if (attribute?.eventUuid !== eventUuid) {
      throw new NotFoundException("Attribute not found in this event");
    }

    // Verify all participants belong to the event
    const uniqueParticipantIds = [...new Set(participantIds)];
    const validParticipantsCount = await this.prisma.participant.count({
      where: {
        uuid: { in: uniqueParticipantIds },
        eventUuid,
      },
    });

    if (validParticipantsCount !== uniqueParticipantIds.length) {
      throw new BadRequestException(
        "One or more participants do not belong to this event",
      );
    }

    // Validate value using common logic
    const validatedAttributes = await this.prepareAttributesForSave(eventUuid, [
      { attributeUuid, value: newValue },
    ]);

    if (validatedAttributes.length === 0) {
      throw new BadRequestException("Invalid attribute or value");
    }

    const valueToSave = validatedAttributes[0].value;

    await this.prisma.$transaction(async (tx) => {
      // Delete existing
      await tx.participantAttribute.deleteMany({
        where: {
          attributeUuid,
          participantUuid: { in: uniqueParticipantIds },
        },
      });

      // Insert new values
      await tx.participantAttribute.createMany({
        data: uniqueParticipantIds.map((pUuid) => ({
          participantUuid: pUuid,
          attributeUuid,
          value: valueToSave,
        })),
      });
    });
  }
}
