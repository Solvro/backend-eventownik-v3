import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import { parseSortInput } from "src/common/utils/prisma.utility";
import { Prisma } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import {
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
    const { email, permissionIds } = createOrganizerDto;

    const admin = await this.prisma.admin.findFirst({
      where: { email },
    });

    if (admin == null) {
      throw new NotFoundException("admin, event or permission not found");
    }

    return await this.prisma.$transaction(async (prisma) => {
      try {
        const creationPromises = permissionIds.map(async (permissionUuid) =>
          prisma.adminPermission.create({
            data: {
              eventUuid,
              adminUuid: admin.uuid,
              permissionUuid,
            },
          }),
        );

        return await Promise.all(creationPromises);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2003" // P2003 - foregin key constraint failed
        ) {
          throw new NotFoundException("admin, event or permission not found");
        }
        throw error;
      }
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

  async findOne(eventUuid: string, organizerUuid: string) {
    const organizer = await this.prisma.admin.findFirst({
      where: {
        uuid: organizerUuid,
        permissions: {
          some: {
            eventUuid,
          },
        },
      },
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
    });

    if (organizer == null) {
      throw new NotFoundException(
        `organizer or event does not exist, or the organizer isnt assigned to event: ${eventUuid}`,
      );
    }

    return organizer;
  }

  async update(
    eventUuid: string,
    organizerUuid: string,
    updateOrganizerDto: UpdateOrganizerDto,
  ) {
    const { permissionIds } = updateOrganizerDto;

    return await this.prisma.$transaction(async (prisma) => {
      const admin = await prisma.admin.findFirst({
        where: {
          uuid: organizerUuid,
          permissions: {
            some: {
              eventUuid,
            },
          },
        },
      });

      if (admin == null) {
        throw new NotFoundException("admin, event or permission not found");
      }

      await prisma.adminPermission.deleteMany({
        where: {
          eventUuid,
          adminUuid: organizerUuid,
        },
      });

      try {
        const creationPromises = permissionIds.map(async (permissionUuid) =>
          prisma.adminPermission.create({
            data: {
              eventUuid,
              adminUuid: organizerUuid,
              permissionUuid,
            },
          }),
        );

        await Promise.all(creationPromises);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2003" // P2003 - foregin key constraint failed
        ) {
          throw new NotFoundException("admin, event or permission not found");
        }
        throw error;
      }

      return await prisma.admin.findUnique({
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
    const organizers = await this.prisma.adminPermission.groupBy({
      by: ["adminUuid"],
      where: {
        eventUuid,
      },
    });

    if (!organizers.some((org) => org.adminUuid === organizerUuid)) {
      throw new NotFoundException(
        "Organizer was not assigned to this event or does not exist",
      );
    }

    if (organizers.length === 1) {
      throw new ForbiddenException(
        "Unable to remove the last organizer from the event.",
      );
    }

    await this.prisma.adminPermission.deleteMany({
      where: {
        adminUuid: organizerUuid,
        eventUuid,
      },
    });
  }
}
