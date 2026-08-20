import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import { parseSortInput } from "src/common/utils/prisma.utility";
import type { Event as EventModel } from "src/generated/prisma/client";
import { Prisma } from "src/generated/prisma/client";
import { OrganizerType } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";
import { StorageService } from "src/storage/storage.service";

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { EventCreateDto } from "./dto/event-create.dto";
import { EventListingDto } from "./dto/event-listing.dto";
import { EventUpdateDto } from "./dto/event-update.dto";
import { Event } from "./entities/event.entity";

@Injectable()
export class EventsService {
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    configService: ConfigService,
  ) {
    this.bucket = configService.getOrThrow<string>("S3_BUCKET_EVENTS");
  }

  private resolvePhotoUrl<T extends { photoKey: string | null }>(
    event: T,
  ): Omit<T, "photoKey"> & { photoUrl: string | null } {
    const { photoKey, ...rest } = event;
    return {
      ...rest,
      photoUrl:
        photoKey == null
          ? null
          : this.storageService.getUrl(this.bucket, photoKey),
    };
  }

  private verificationData(
    isVerified: boolean | undefined,
    userType: OrganizerType,
  ): Pick<Prisma.EventUncheckedCreateInput, "isVerified" | "verifiedAt"> {
    if (userType !== OrganizerType.superadmin || isVerified === undefined) {
      return {};
    }
    return { isVerified, verifiedAt: isVerified ? new Date() : null };
  }

  private async findPage(
    query: EventListingDto,
    baseWhere: Prisma.EventWhereInput,
  ): Promise<PageDto<Event>> {
    const { skip, take, name, location, before, after, sort } = query;
    const where: Prisma.EventWhereInput = {
      ...baseWhere,
      ...(name === undefined
        ? {}
        : { name: { contains: name, mode: "insensitive" } }),
      ...(location === undefined
        ? {}
        : { location: { contains: location, mode: "insensitive" } }),
      ...(before === undefined ? {} : { startDate: { lte: before } }),
      ...(after === undefined ? {} : { endDate: { gte: after } }),
    };

    const orderBy = parseSortInput(sort, ["name", "location", "createdAt"]);

    if (orderBy.length === 0) {
      orderBy.push({ createdAt: "desc" });
    }

    const [itemCount, events] = await this.prisma.$transaction([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          links: true,
        },
      }),
    ]);

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto: query });
    return new PageDto(
      events.map((event) => this.resolvePhotoUrl(event)),
      pageMetaDto,
    );
  }

  async findAll(
    query: EventListingDto,
    eventsIds: string[],
    userType: OrganizerType,
  ): Promise<PageDto<Event>> {
    return this.findPage(
      query,
      userType === OrganizerType.superadmin ? {} : { uuid: { in: eventsIds } },
    );
  }

  async findAllPublic(query: EventListingDto): Promise<PageDto<Event>> {
    return this.findPage(query, { isPublic: true, isVerified: true });
  }

  async create(
    eventDto: EventCreateDto,
    photo: Express.Multer.File | undefined,
    adminUuid: string,
    userType: OrganizerType,
  ): Promise<Event> {
    const { links, isVerified, ...data } = eventDto;

    const photoKey =
      photo === undefined
        ? null
        : await this.storageService.upload(this.bucket, photo);

    try {
      const event = await this.prisma.$transaction(async (tx) => {
        const createdEvent = await tx.event.create({
          data: {
            ...data,
            ...this.verificationData(isVerified, userType),
            photoKey,
            organizerAdmin: {
              connect: { uuid: adminUuid },
            },
            links: {
              create: links,
            },
          },
          include: {
            links: true,
          },
        });

        await tx.eventPermission.create({
          data: {
            event: { connect: { uuid: createdEvent.uuid } },
            admin: { connect: { uuid: adminUuid } },
            permission: "MANAGE_ALL",
          },
        });

        return createdEvent;
      });

      return this.resolvePhotoUrl(event);
    } catch (error) {
      if (photoKey !== null) {
        await this.storageService.delete(this.bucket, photoKey);
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          `Event with slug ${eventDto.slug} already exists`,
        );
      }
      throw error;
    }
  }

  async findOne(uuid: string): Promise<Event> {
    // TODO: superadmin dowolny, organizator swoje
    const event = await this.prisma.event.findUnique({
      where: { uuid },
      include: {
        links: true,
      },
    });

    if (event == null) {
      throw new NotFoundException(`Event with UUID ${uuid} not found`);
    }

    return this.resolvePhotoUrl(event);
  }

  async findOnePublic(slug: string): Promise<Event> {
    const event = await this.prisma.event.findUnique({
      where: {
        slug,
        isPublic: true,
      },
      include: {
        links: true,
        registerForm: {
          include: {
            formDefinitions: true,
          },
        },
      },
    });

    if (event == null) {
      throw new NotFoundException(`Event with slug ${slug} not found`);
    }

    return this.resolvePhotoUrl(event);
  }

  async update(
    uuid: string,
    eventDto: EventUpdateDto,
    photo: Express.Multer.File | undefined,
    userType: OrganizerType,
  ): Promise<Event> {
    // TODO: superadmin dowolny, organizator swoje
    const { links, isVerified, photoUrl, ...data } = eventDto;
    const removePhoto = photoUrl === null;

    let previousPhotoKey: string | null = null;
    if (photo !== undefined || removePhoto) {
      const existing = await this.prisma.event.findUnique({ where: { uuid } });
      if (existing == null) {
        throw new NotFoundException(`Event with UUID ${uuid} not found`);
      }
      previousPhotoKey = existing.photoKey;
    }

    const newPhotoKey =
      photo === undefined
        ? undefined
        : await this.storageService.upload(this.bucket, photo);
    const photoData =
      newPhotoKey === undefined
        ? removePhoto
          ? { photoKey: null }
          : {}
        : { photoKey: newPhotoKey };
    const updateData = {
      ...data,
      ...this.verificationData(isVerified, userType),
      ...photoData,
    };

    let event: Prisma.EventGetPayload<{ include: { links: true } }>;
    try {
      event =
        links === undefined
          ? await this.prisma.event.update({
              where: { uuid },
              data: updateData,
              include: {
                links: true,
              },
            })
          : await this.prisma.$transaction(async (tx) => {
              await tx.eventLink.deleteMany({
                where: { eventUuid: uuid },
              });

              return await tx.event.update({
                where: { uuid },
                data: {
                  ...updateData,
                  ...(links.length === 0 ? {} : { links: { create: links } }),
                },
                include: {
                  links: true,
                },
              });
            });
    } catch (error) {
      if (newPhotoKey !== undefined) {
        await this.storageService.delete(this.bucket, newPhotoKey);
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new ConflictException(
            `Event with slug ${eventDto.slug ?? ""} already exists`,
          );
        }
        if (error.code === "P2025") {
          throw new NotFoundException(`Event with UUID ${uuid} not found`);
        }
      }
      throw error;
    }

    if (previousPhotoKey !== null) {
      // StorageService.delete swallows S3 errors, so a failed cleanup
      // never fails a request that already succeeded in the database
      await this.storageService.delete(this.bucket, previousPhotoKey);
    }
    return this.resolvePhotoUrl(event);
  }

  async remove(uuid: string): Promise<void> {
    // TODO: superadmin dowolny, organizator swoje
    let event: EventModel;
    try {
      event = await this.prisma.event.delete({
        where: { uuid },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException(`Event with UUID ${uuid} not found`);
      }
      throw error;
    }

    if (event.photoKey !== null) {
      await this.storageService.delete(this.bucket, event.photoKey);
    }
  }
}
