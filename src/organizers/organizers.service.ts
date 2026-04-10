import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import { parseSortInput } from "src/common/utils/prisma.utility";
import { Prisma } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { CreateOrganizerDto } from "./dto/create-organizer.dto";
import { OrganizerListingDto } from "./dto/organizer-listing.dto";
import { UpdateOrganizerDto } from "./dto/update-organizer.dto";

@Injectable()
export class OrganizersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(eventUuid: string, createOrganizerDto: CreateOrganizerDto) {
    const { email, permissions } = createOrganizerDto;

    return await this.prisma.$transaction(async (tx) => {
      const admin = await tx.admin.findFirst({
        where: { email },
      });

      if (admin == null) {
        throw new NotFoundException(`Admin with email: ${email} not found`);
      }

      const event = await tx.event.findUnique({
        where: { uuid: eventUuid },
      });

      if (event == null) {
        throw new NotFoundException(`Event with uuid: ${eventUuid} not found`);
      }

      try {
        await tx.eventPermission.createMany({
          data: permissions.map((permission) => ({
            eventUuid,
            adminUuid: admin.uuid,
            permission,
          })),
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new BadRequestException(
            "One or more permissions already exist for this organizer in this event",
          );
        }

        throw error;
      }

      return tx.admin.findUnique({
        where: { uuid: admin.uuid },
        include: {
          permissions: {
            where: { eventUuid },
          },
        },
      });
    });
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
      OR: [
        {
          events: {
            some: { uuid: eventUuid },
          },
        },
        {
          permissions: {
            some: { eventUuid },
          },
        },
      ],
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
        omit: {
          password: true,
        },
        include: {
          permissions: {
            where: {
              eventUuid,
            },
          },
        },
      }),
    ]);

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto: query });
    return new PageDto(organizers, pageMetaDto);
  }

  async findOne(eventUuid: string, organizerUuid: string) {
    const organizer = await this.prisma.admin.findFirst({
      where: {
        uuid: organizerUuid,
        OR: [
          {
            events: {
              some: { uuid: eventUuid },
            },
          },
          {
            permissions: {
              some: { eventUuid },
            },
          },
        ],
      },
      omit: {
        password: true,
      },
      include: {
        permissions: {
          where: {
            eventUuid,
          },
        },
      },
    });

    if (organizer == null) {
      throw new NotFoundException(
        `organizer or event does not exist, or the organizer is not assigned to event: ${eventUuid}`,
      );
    }

    return organizer;
  }

  async update(
    eventUuid: string,
    organizerUuid: string,
    updateOrganizerDto: UpdateOrganizerDto,
  ) {
    const { permissions } = updateOrganizerDto;

    return await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { uuid: eventUuid },
      });

      if (event == null) {
        throw new NotFoundException(`Event with uuid: ${eventUuid} not found`);
      }

      const admin = await tx.admin.findUnique({
        where: { uuid: organizerUuid },
      });

      if (admin == null) {
        throw new NotFoundException(
          `Organizer with uuid: ${organizerUuid} not found`,
        );
      }

      const isAssigned = await tx.admin.findFirst({
        where: {
          uuid: organizerUuid,
          OR: [
            {
              events: {
                some: { uuid: eventUuid },
              },
            },
            {
              permissions: {
                some: { eventUuid },
              },
            },
          ],
        },
      });

      if (isAssigned == null) {
        throw new NotFoundException(
          `Organizer with uuid: ${organizerUuid} is not assigned to event: ${eventUuid}`,
        );
      }

      await tx.eventPermission.deleteMany({
        where: {
          eventUuid,
          adminUuid: organizerUuid,
        },
      });

      await tx.eventPermission.createMany({
        data: permissions.map((permission) => ({
          eventUuid,
          adminUuid: organizerUuid,
          permission,
        })),
      });

      return await tx.admin.findUnique({
        where: { uuid: organizerUuid },
        include: {
          permissions: {
            where: {
              eventUuid,
            },
          },
        },
        omit: {
          password: true,
        },
      });
    });
  }

  async remove(eventUuid: string, organizerUuid: string) {
    const targetOrganizer = await this.prisma.admin.findFirst({
      where: {
        uuid: organizerUuid,
        OR: [
          {
            events: {
              some: { uuid: eventUuid },
            },
          },
          {
            permissions: {
              some: { eventUuid },
            },
          },
        ],
      },
    });

    if (targetOrganizer == null) {
      throw new NotFoundException(
        "Organizer was not assigned to this event or does not exist",
      );
    }

    const organizersCount = await this.prisma.admin.count({
      where: {
        OR: [
          {
            events: {
              some: { uuid: eventUuid },
            },
          },
          {
            permissions: {
              some: { eventUuid },
            },
          },
        ],
      },
    });

    if (organizersCount <= 1) {
      throw new ForbiddenException(
        "Unable to remove the last organizer from the event.",
      );
    }

    await this.prisma.eventPermission.deleteMany({
      where: {
        adminUuid: organizerUuid,
        eventUuid,
      },
    });
  }
}
