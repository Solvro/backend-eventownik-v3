import { normalizeParticipantAttributeValue } from "src/attributes/attribute-value-normalizer";
import { AttributeChangedEvent } from "src/common/events/attribute-changed.event";
import {
  ATTRIBUTE_CHANGED_EVENT,
  PARTICIPANT_DELETED_EVENT,
  PARTICIPANT_REGISTERED_EVENT,
} from "src/common/events/event-names.constants";
import { ParticipantDeletedEvent } from "src/common/events/participant-deleted.event";
import { ParticipantRegisteredEvent } from "src/common/events/participant-registered.event";
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
import { EventEmitter2 } from "@nestjs/event-emitter";

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

const FILE_LIKE_ATTRIBUTE_TYPES: AttributeType[] = [
  AttributeType.file,
  AttributeType.drawing,
];

function isFileLikeAttributeType(
  type: AttributeType | null | undefined,
): boolean {
  return type != null && FILE_LIKE_ATTRIBUTE_TYPES.includes(type);
}

@Injectable()
export class ParticipantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private mapToEntity(participant: ParticipantWithRelations): Participant {
    return {
      uuid: participant.uuid,
      email: participant.email,
      createdAt: participant.createdAt,
      attributes:
        participant.attributes?.map((attribute) => ({
          uuid: attribute.attributeUuid,
          name: attribute.attribute?.name ?? "",
          value:
            isFileLikeAttributeType(attribute.attribute?.type) &&
            typeof attribute.value === "string" &&
            attribute.value.length > 0
              ? this.storageService.getUrl(
                  this.configService.getOrThrow("S3_BUCKET_FORMS"),
                  attribute.value,
                )
              : attribute.value,
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

  private resolveUntrustedFileValue(
    attributeUuid: string,
    rawValue: unknown,
    currentValue: Prisma.JsonValue | null,
  ): unknown {
    if (rawValue == null || rawValue === "") {
      return rawValue;
    }

    if (typeof rawValue !== "string") {
      throw new BadRequestException(
        `Attribute ${attributeUuid} must be a string value.`,
      );
    }

    const bucket = this.configService.getOrThrow<string>("S3_BUCKET_FORMS");
    const strippedValue = this.storageService.extractKey(bucket, rawValue);

    if (currentValue == null || strippedValue !== currentValue) {
      throw new BadRequestException(
        `Attribute ${attributeUuid} cannot be set to a new value directly; upload a new file through a form instead.`,
      );
    }

    return strippedValue;
  }

  private async prepareAttributesForSave(
    eventUuid: string,
    participantAttributes?: ParticipantAttributeDto[],
    options: {
      trustedFileValues?: boolean;
      currentParticipantUuid?: string;
    } = {},
  ): Promise<
    Prisma.ParticipantAttributeUncheckedCreateWithoutParticipantInput[]
  > {
    if (participantAttributes == null || participantAttributes.length === 0) {
      return [];
    }

    const { trustedFileValues = false, currentParticipantUuid } = options;

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

    let currentFileValues: Map<string, Prisma.JsonValue> | null = null;
    if (!trustedFileValues && currentParticipantUuid !== undefined) {
      const fileAttributeUuids = participantAttributes
        .filter((attribute) =>
          isFileLikeAttributeType(
            validAttributeMap.get(attribute.attributeUuid)?.type,
          ),
        )
        .map((attribute) => attribute.attributeUuid);

      if (fileAttributeUuids.length > 0) {
        const existingValues = await this.prisma.participantAttribute.findMany({
          where: {
            participantUuid: currentParticipantUuid,
            attributeUuid: { in: fileAttributeUuids },
          },
          select: { attributeUuid: true, value: true },
        });
        currentFileValues = new Map(
          existingValues.map((existing) => [
            existing.attributeUuid,
            existing.value,
          ]),
        );
      }
    }

    const transformedAttributes: Prisma.ParticipantAttributeUncheckedCreateWithoutParticipantInput[] =
      [];

    for (const attribute of participantAttributes) {
      const matchingAttribute = validAttributeMap.get(attribute.attributeUuid);
      if (matchingAttribute == null) {
        continue;
      }

      const valueToNormalize =
        isFileLikeAttributeType(matchingAttribute.type) && !trustedFileValues
          ? this.resolveUntrustedFileValue(
              attribute.attributeUuid,
              attribute.value,
              currentFileValues?.get(attribute.attributeUuid) ?? null,
            )
          : attribute.value;

      const valueToSave = await normalizeParticipantAttributeValue(
        this.prisma,
        {
          attributeUuid: attribute.attributeUuid,
          type: matchingAttribute.type,
          config: matchingAttribute.config,
        },
        valueToNormalize,
      );

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
    options: { trustedFileValues?: boolean } = {},
  ): Promise<Participant> {
    try {
      const participant = await this.prisma.$transaction(async (tx) => {
        const event = await tx.event.findUnique({ where: { uuid: eventUuid } });
        if (event == null) {
          throw new NotFoundException(`Event NOT FOUND`);
        }

        const attributesToCreate = await this.prepareAttributesForSave(
          eventUuid,
          participantAttributes,
          { trustedFileValues: options.trustedFileValues },
        );

        const createdParticipant = await tx.participant.create({
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

        return this.mapToEntity(createdParticipant);
      });

      this.eventEmitter.emit(
        PARTICIPANT_REGISTERED_EVENT,
        new ParticipantRegisteredEvent(participant.uuid, eventUuid),
      );

      return participant;
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
    options: { trustedFileValues?: boolean } = {},
  ): Promise<Participant> {
    const { participantAttributes, ...updates } = updateDto;

    const participant = await this.prisma.participant.findUnique({
      where: { uuid: participantUuid },
    });

    if (participant?.eventUuid !== eventUuid) {
      throw new NotFoundException("Participant not found in this event");
    }

    try {
      const fileKeysToDelete: string[] = [];
      let savedAttributes: Prisma.ParticipantAttributeUncheckedCreateWithoutParticipantInput[] =
        [];
      const result = await this.prisma.$transaction(async (tx) => {
        const dataToUpdate: Prisma.ParticipantUpdateInput = { ...updates };

        if (participantAttributes !== undefined) {
          const attributesToSave = await this.prepareAttributesForSave(
            eventUuid,
            participantAttributes,
            {
              trustedFileValues: options.trustedFileValues,
              currentParticipantUuid: participantUuid,
            },
          );
          savedAttributes = attributesToSave;

          const attributeUuidsToUpdate = attributesToSave.map(
            (a) => a.attributeUuid,
          );

          if (attributeUuidsToUpdate.length > 0) {
            const existingFileAttributes =
              await tx.participantAttribute.findMany({
                where: {
                  participantUuid,
                  attributeUuid: { in: attributeUuidsToUpdate },
                  attribute: { type: { in: FILE_LIKE_ATTRIBUTE_TYPES } },
                },
              });

            const newValueByAttributeUuid = new Map(
              attributesToSave.map((attribute) => [
                attribute.attributeUuid,
                attribute.value,
              ]),
            );

            await tx.participantAttribute.deleteMany({
              where: {
                participantUuid,
                attributeUuid: { in: attributeUuidsToUpdate },
              },
            });

            for (const attribute of existingFileAttributes) {
              if (
                typeof attribute.value === "string" &&
                attribute.value.length > 0 &&
                attribute.value !==
                  newValueByAttributeUuid.get(attribute.attributeUuid)
              ) {
                fileKeysToDelete.push(attribute.value);
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

      if (fileKeysToDelete.length > 0) {
        const bucket = this.configService.getOrThrow<string>("S3_BUCKET_FORMS");
        for (const key of fileKeysToDelete) {
          await this.storageService.delete(bucket, key);
        }
      }

      for (const attribute of savedAttributes) {
        const emittedValue =
          attribute.value == null ||
          attribute.value === Prisma.JsonNull ||
          attribute.value === Prisma.DbNull
            ? null
            : (attribute.value as Prisma.JsonValue);

        this.eventEmitter.emit(
          ATTRIBUTE_CHANGED_EVENT,
          new AttributeChangedEvent(
            attribute.attributeUuid,
            participantUuid,
            eventUuid,
            emittedValue,
          ),
        );
      }

      return result;
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
          include: { attribute: true },
        },
      },
    });

    if (participant == null) {
      throw new NotFoundException("Participant not found");
    }

    await this.prisma.participant.delete({
      where: { uuid: participantUuid },
    });

    this.eventEmitter.emit(
      PARTICIPANT_DELETED_EVENT,
      new ParticipantDeletedEvent(
        {
          uuid: participant.uuid,
          email: participant.email,
          createdAt: participant.createdAt,
          updatedAt: participant.updatedAt,
          attributes: participant.attributes.map((attribute) => ({
            attributeUuid: attribute.attributeUuid,
            value: attribute.value,
          })),
        },
        eventUuid,
      ),
    );

    const bucket = this.configService.getOrThrow<string>("S3_BUCKET_FORMS");
    for (const attribute of participant.attributes) {
      if (
        typeof attribute.value === "string" &&
        attribute.value.length > 0 &&
        isFileLikeAttributeType(attribute.attribute.type)
      ) {
        await this.storageService.delete(bucket, attribute.value);
      }
    }
  }

  async removeMany(eventUuid: string, participantsToUnregisterIds: string[]) {
    const participants = await this.prisma.participant.findMany({
      where: { uuid: { in: participantsToUnregisterIds }, eventUuid },
      include: {
        attributes: {
          include: { attribute: true },
        },
      },
    });

    await this.prisma.participant.deleteMany({
      where: {
        uuid: { in: participantsToUnregisterIds },
        eventUuid,
      },
    });

    for (const participant of participants) {
      this.eventEmitter.emit(
        PARTICIPANT_DELETED_EVENT,
        new ParticipantDeletedEvent(
          {
            uuid: participant.uuid,
            email: participant.email,
            createdAt: participant.createdAt,
            updatedAt: participant.updatedAt,
            attributes: participant.attributes.map((attribute) => ({
              attributeUuid: attribute.attributeUuid,
              value: attribute.value,
            })),
          },
          eventUuid,
        ),
      );
    }

    const bucket = this.configService.getOrThrow<string>("S3_BUCKET_FORMS");
    for (const participant of participants) {
      for (const attribute of participant.attributes) {
        if (
          typeof attribute.value === "string" &&
          attribute.value.length > 0 &&
          isFileLikeAttributeType(attribute.attribute.type)
        ) {
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

    const bucket = this.configService.getOrThrow<string>("S3_BUCKET_FORMS");
    return {
      ...participant,
      attributes: participant.attributes.map((attribute) => ({
        ...attribute,
        value:
          isFileLikeAttributeType(attribute.attribute.type) &&
          typeof attribute.value === "string" &&
          attribute.value.length > 0
            ? this.storageService.getUrl(bucket, attribute.value)
            : attribute.value,
      })),
    };
  }

  async bulkUpdateAttributes(
    eventUuid: string,
    attributeUuid: string,
    newValue: string | undefined,
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

    const fileKeysToDelete: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      if (isFileLikeAttributeType(attribute.type)) {
        const existingFileAttributes = await tx.participantAttribute.findMany({
          where: {
            attributeUuid,
            participantUuid: { in: uniqueParticipantIds },
          },
        });

        const staleKeys = new Set(
          existingFileAttributes
            .map((existing) => existing.value)
            .filter(
              (value): value is string =>
                typeof value === "string" &&
                value.length > 0 &&
                value !== valueToSave,
            ),
        );
        fileKeysToDelete.push(...staleKeys);
      }

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

    if (fileKeysToDelete.length > 0) {
      const bucket = this.configService.getOrThrow<string>("S3_BUCKET_FORMS");
      for (const key of fileKeysToDelete) {
        await this.storageService.delete(bucket, key);
      }
    }

    const emittedValue =
      valueToSave == null ||
      valueToSave === Prisma.JsonNull ||
      valueToSave === Prisma.DbNull
        ? null
        : (valueToSave as Prisma.JsonValue);

    for (const participantUuid of uniqueParticipantIds) {
      this.eventEmitter.emit(
        ATTRIBUTE_CHANGED_EVENT,
        new AttributeChangedEvent(
          attributeUuid,
          participantUuid,
          eventUuid,
          emittedValue,
        ),
      );
    }
  }
  async getPublicBlockAttributes(
    eventId: string,
    blockId: string,
    requestedFields: string[],
  ) {
    if (requestedFields.length === 0) {
      return [];
    }

    const wantsEmail = requestedFields.includes("email");
    const attributeIds = requestedFields.filter((field) => field !== "email");

    if (attributeIds.length > 0) {
      const validAttributesCount = await this.prisma.attribute.count({
        where: {
          eventUuid: eventId,
          uuid: { in: attributeIds },
        },
      });

      if (validAttributesCount !== attributeIds.length) {
        throw new BadRequestException(
          "One or more requested attributes are invalid for this event.",
        );
      }
    }

    const participants = await this.prisma.participant.findMany({
      where: {
        eventUuid: eventId,
        attributes: {
          some: {
            value: {
              array_contains: blockId,
            },
          },
        },
      },
      select: {
        email: wantsEmail,
        attributes: {
          where: {
            attributeUuid: { in: attributeIds },
          },
          select: {
            attributeUuid: true,
            value: true,
          },
        },
      },
    });

    return participants.map((participant) => {
      const row: Record<string, Prisma.JsonValue> = {};

      for (const [index, field] of requestedFields.entries()) {
        if (field === "email") {
          row[index] = participant.email;
        } else {
          const attribute = participant.attributes.find(
            (a) => a.attributeUuid === field,
          );

          row[index] = attribute?.value ?? null;
        }
      }

      return row;
    });
  }
}
