import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import { Participant, Prisma } from "src/generated/prisma/client";
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

@Injectable()
export class ParticipantsService {
  constructor(private readonly prisma: PrismaService) {}

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

      if (type === "block") {
        if (valueToSave == null || valueToSave === "null") {
          valueToSave = null;
        } else {
          const block = await this.prisma.block.findUnique({
            where: { uuid: valueToSave },
          });
          if (block == null) {
            throw new BadRequestException(
              `Block with UUID ${valueToSave} does not exist.`,
            );
          }
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

  async createParticipant(eventUuid: string, createDto: ParticipantCreateDto) {
    const { participantAttributes, ...participantData } = createDto;

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
            ...participantData,
            eventUuid,
            attributes: {
              create: attributesToCreate,
            },
          },
          include: {
            attributes: true,
          },
        });

        // TODO: Integrate EmailService -> trigger 'participant_registered'

        return participant;
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
  ) {
    const { participantAttributes, ...updates } = updateDto;

    const participant = await this.prisma.participant.findUnique({
      where: { uuid: participantUuid },
    });

    if (participant?.eventUuid !== eventUuid) {
      throw new NotFoundException("Participant not found in this event");
    }

    try {
      const txResult = await this.prisma.$transaction(async (tx) => {
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

        return await tx.participant.update({
          where: { uuid: participantUuid },
          data: dataToUpdate,
          include: {
            attributes: {
              include: { attribute: true },
              where: { attribute: { showInList: true } },
            },
          },
        });
      });

      return txResult;
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
    const participants = await this.prisma.participant.findMany({
      where: {
        uuid: { in: participantsToUnregisterIds },
        eventUuid,
      },
    });

    // TODO: Send emails for each unregister

    await this.prisma.participant.deleteMany({
      where: {
        uuid: { in: participants.map((p) => p.uuid) },
        eventUuid,
      },
    });
  }

  async findAll(eventUuid: string, query: ParticipantListingDto) {
    const { skip, take, bonus_attributes, filters } = query;

    let filterQuery: Prisma.ParticipantWhereInput = {};
    if (filters != null) {
      try {
        const parsedFilters: unknown =
          typeof filters === "string" ? JSON.parse(filters) : filters;
        if (typeof parsedFilters === "object" && parsedFilters != null) {
          filterQuery = {
            AND: Object.entries(parsedFilters as Record<string, unknown>).map(
              ([attributeUuid, value]) => ({
                attributes: {
                  some: {
                    attributeUuid,
                    value: value as string,
                  },
                },
              }),
            ),
          };
        }
      } catch {
        // Ignored
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

    const data = participants.map((participant) => ({
      uuid: participant.uuid,
      email: participant.email,
      createdAt: participant.createdAt,
      attributes: participant.attributes.map((attribute) => ({
        uuid: attribute.attributeUuid,
        name: attribute.attribute.name,
        value: attribute.value,
        createdAt: attribute.createdAt,
        updatedAt: attribute.updatedAt,
      })),
    }));

    return new PageDto(data as unknown as Participant[], pageMetaDto);
  }

  async findOne(eventUuid: string, participantUuid: string) {
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

    return {
      uuid: participant.uuid,
      email: participant.email,
      createdAt: participant.createdAt,
      attributes: participant.attributes.map((attribute) => ({
        uuid: attribute.attributeUuid,
        name: attribute.attribute.name,
        value: attribute.value,
        createdAt: attribute.createdAt,
        updatedAt: attribute.updatedAt,
      })),
      emails: participant.emails.map((emailStatus) => ({
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
          value: newValue,
        })),
      });
    });
  }
}
