import { Prisma } from "@prisma/client";

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { QueryListingDto } from "../prisma/dto/query-listing.dto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEventDto } from "./dtos/create-event.dto";
import { UpdateEventDto } from "./dtos/update-event.dto";

@Injectable()
export class EventsService {
  constructor(private readonly prismaService: PrismaService) {}

  async index(query: QueryListingDto) {
    const prismaQuery = query.toPrisma("Event");
    const organizer_uuid: string = process.env.ADMIN_UUID ?? "";
    const admin = await this.prismaService.admin.findMany({
      where: { uuid: organizer_uuid },
    });
    if (admin.length === 0) {
      throw new NotFoundException("Organizer not found");
    }

    return await this.prismaService.event.findMany({
      ...prismaQuery,
      where: {
        ...prismaQuery.where,
        organizerAdmin: { uuid: organizer_uuid },
      },
    });
  }

  async show(uuid: string) {
    // taki szpont, jak będzie auth to to się wywali
    const organizer_uuid: string = process.env.ADMIN_UUID ?? "";
    const admin = await this.prismaService.admin.findMany({
      where: { uuid: organizer_uuid },
    });
    if (admin.length === 0) {
      throw new NotFoundException("Organizer not found");
    }

    const event = await this.prismaService.event.findFirst({
      where: { uuid, organizerAdmin: { uuid: organizer_uuid } },
    });
    if (event === null) {
      throw new NotFoundException("Event not found");
    }

    const permission = await this.prismaService.adminPermission.findFirst({
      where: { adminUuid: organizer_uuid, eventUuid: uuid },
    });

    if (permission === null) {
      throw new ForbiddenException("This action is forbidden");
    }

    return event;
  }

  async publicShow(slug: string) {
    const event = await this.prismaService.event.findFirst({
      where: { slug },
      include: { registerForm: true },
    });
    if (event === null) {
      throw new NotFoundException("Event not found");
    }
    if (event.registerForm === null) {
      throw new NotFoundException("Event has no registration form");
    }
    return event.registerForm;
  }

  async create(createEventDto: CreateEventDto) {
    // taki szpont, jak będzie auth to to się wywali
    const organizer_uuid: string = process.env.ADMIN_UUID ?? "";
    const admin = await this.prismaService.admin.findMany({
      where: { uuid: organizer_uuid },
    });
    if (admin.length === 0) {
      throw new NotFoundException("Organizer not found");
    }

    const dto = createEventDto as Prisma.EventCreateInput;
    const permission = await this.prismaService.permission.findFirst({
      where: { action: "manage", subject: "all" },
    });

    if (permission === null) {
      throw new NotFoundException("Permission not found");
    }

    return await this.prismaService.event.create({
      data: {
        ...dto,
        organizerAdmin: { connect: { uuid: organizer_uuid } },
        adminPermissions: {
          create: {
            permissionUuid: permission.uuid,
            adminUuid: organizer_uuid,
          },
        },
      },
    });
  }

  async update(uuid: string, updateEventDto: UpdateEventDto) {
    // taki szpont, jak będzie auth to to się wywali
    const organizer_uuid: string = process.env.ADMIN_UUID ?? "";
    const admin = await this.prismaService.admin.findMany({
      where: { uuid: organizer_uuid },
    });
    if (admin.length === 0) {
      throw new NotFoundException("Organizer not found");
    }
    const event = await this.prismaService.event.findUnique({
      where: { uuid },
    });
    if (event === null) {
      throw new NotFoundException("Event not found");
    }

    const adminPermission = await this.prismaService.adminPermission.findFirst({
      where: { adminUuid: organizer_uuid, eventUuid: uuid },
    });

    if (adminPermission === null) {
      throw new ForbiddenException("This action is forbidden");
    }

    const dto = updateEventDto as Prisma.EventUpdateInput;

    return await this.prismaService.event.update({
      where: { uuid },
      data: {
        ...dto,
      },
    });
  }

  async remove(uuid: string) {
    // taki szpont, jak będzie auth to to się wywali

    const organizer_uuid: string = process.env.ADMIN_UUID ?? "";
    const admin = await this.prismaService.admin.findMany({
      where: { uuid: organizer_uuid },
    });
    if (admin.length === 0) {
      throw new NotFoundException("Organizer not found");
    }

    const event = await this.prismaService.event.findUnique({
      where: { uuid, organizerAdmin: { uuid: organizer_uuid } },
    });
    if (event === null) {
      throw new NotFoundException("Event not found");
    }

    return await this.prismaService.event.delete({
      where: { uuid },
    });
  }
}
