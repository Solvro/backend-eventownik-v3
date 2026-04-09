import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import {
  Attribute,
  EmailTemplate,
  ParticipantAttribute,
  ParticipantEmailStatus,
  Prisma,
  Participant as PrismaParticipant,
} from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

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
  constructor(private readonly prisma: PrismaService) {}

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
        triggerValue: emailStatus.email?.triggerValue,
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
      select: { uuid: true, type: true },
    });

    const validAttributeMap = new Map<string, string>();
    for (const attribute of eventAttributes) {
      validAttributeMap.set(attribute.uuid, attribute.type);
    }

    const transformedAttributes: Prisma.ParticipantAttributeUncheckedCreateWithoutParticipantInput[] =
      [];

    for (const attribute of participantAttributes) {
      if (!validAttributeMap.has(attribute.attributeUuid)) {
        continue;
      }

      const type = validAttributeMap.get(attribute.attributeUuid);
      let valueToSave = attribute.value;

      switch (type) {
        case "block": {
          if (valueToSave == null || valueToSave === "null") {
            valueToSave = null;
          } else {
            const block = await this.prisma.block.findFirst({
              where: {
                uuid: valueToSave,
                attribute: { eventUuid },
              },
            });
            if (block == null) {
              throw new BadRequestException(
                `Block with UUID ${valueToSave} does not exist.`,
              );
            }
          }

          break;
        }
        case "number": {
          if (valueToSave != null && Number.isNaN(Number(valueToSave))) {
            throw new BadRequestException(
              `Attribute ${attribute.attributeUuid} must be a valid number.`,
            );
          }

          break;
        }
        case "date":
        case "datetime": {
          if (valueToSave != null && Number.isNaN(Date.parse(valueToSave))) {
            throw new BadRequestException(
              `Attribute ${attribute.attributeUuid} must be a valid date/time format.`,
            );
          }

          break;
        }
        case "checkbox": {
          if (
            valueToSave != null &&
            !["true", "false", "1", "0", "on", "off"].includes(
              valueToSave.toLowerCase(),
            )
          ) {
            throw new BadRequestException(
              `Attribute ${attribute.attributeUuid} must be a boolean value.`,
            );
          }

          break;
        }
        case undefined:
        default: {
          break;
        }
      }

      // TODO: Integrate EmailService for attribute_changed trigger
      // EmailService.sendOnTrigger(event, participant, "attribute_changed", attr.attributeUuid, valueToSave);

      transformedAttributes.push({
        attributeUuid: attribute.attributeUuid,
        value: valueToSave,
      });
    }

    return transformedAttributes;
  }

  async createParticipant(
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

  async updateParticipant(
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
            await tx.participantAttribute.deleteMany({
              where: {
                participantUuid,
                attributeUuid: { in: attributeUuidsToUpdate },
              },
            });
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

  async unregister(eventUuid: string, participantUuid: string) {
    const participant = await this.prisma.participant.findFirst({
      where: { uuid: participantUuid, eventUuid },
    });

    if (participant == null) {
      throw new NotFoundException("Participant not found");
    }

    // TODO: Integrate EmailService.sendOnTrigger(event, participant, "participant_deleted");

    await this.prisma.participant.delete({
      where: { uuid: participantUuid },
    });
  }

  async unregisterMany(
    eventUuid: string,
    participantsToUnregisterIds: string[],
  ) {
    // TODO: Send emails for each unregister (requires fetching emails or moving logic to a job)

    await this.prisma.participant.deleteMany({
      where: {
        uuid: { in: participantsToUnregisterIds },
        eventUuid,
      },
    });
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
                    value: value as string,
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
          value: valueToSave ?? "",
        })),
      });
    });
  }
}
