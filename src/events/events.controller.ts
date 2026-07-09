import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { AuthUser } from "src/auth/jwt.strategy";
import { RequirePermission } from "src/auth/permissions.decorator";
import { PermissionsGuard } from "src/auth/permissions.guard";
import { ApiPaginatedResponse } from "src/common/decorators/api-paginated-response.decorator";
import { PageDto } from "src/common/dto/page.dto";
import { PermissionType } from "src/generated/prisma/enums";
import { StorageService } from "src/storage/storage.service";

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { EventCreateDto } from "./dto/event-create.dto";
import { EventListingDto } from "./dto/event-listing.dto";
import { EventUpdateDto } from "./dto/event-update.dto";
import { Event } from "./entities/event.entity";
import { EventsService } from "./events.service";
import { UploadPhoto } from "./utils/upload-photo.decorator";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "Unauthorized" })
@ApiForbiddenResponse({ description: "Forbidden - insufficient permissions" })
@ApiTags("Events")
@Controller("events")
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  private resolvePhotoUrl(event: Event): Event {
    if (event.photoUrl === null) {
      return event;
    }
    return Object.assign({} as Event, event, {
      photoUrl: this.storageService.getUrl(
        this.configService.getOrThrow("S3_BUCKET_EVENTS"),
        event.photoUrl,
      ),
    });
  }

  @Get()
  @ApiOperation({ summary: "Get list of events with pagination and filtering" })
  @ApiPaginatedResponse(Event)
  async findAll(
    @Query() dto: EventListingDto,
    @Request() request: { user: AuthUser },
  ): Promise<PageDto<Event>> {
    // z auth'em, zwracać swoje eventy / wszystkie dla superadmina
    const eventsIds = request.user.permissions.map((p) => p.eventId);
    const result = await this.eventsService.findAll(
      dto,
      eventsIds,
      request.user.type,
    );
    return new PageDto<Event>(
      result.data.map((event_) => this.resolvePhotoUrl(event_ as Event)),
      result.meta,
    );
  }

  @Post()
  @UploadPhoto()
  @ApiOperation({ summary: "Create a new event" })
  @ApiCreatedResponse({ description: "The created event", type: Event })
  async create(
    @UploadedFile()
    photo: Express.Multer.File | undefined,
    @Body() eventDto: EventCreateDto,
    @Request() request: { user: AuthUser },
  ): Promise<Event> {
    let photoKey = eventDto.photoUrl ?? null;
    const bucket = this.configService.getOrThrow<string>("S3_BUCKET_EVENTS");

    if (photo !== undefined) {
      photoKey = await this.storageService.upload(bucket, photo);
    }

    eventDto.applyUserTypeRestrictions(request.user.type);
    try {
      const event = await this.eventsService.create(
        eventDto,
        photoKey,
        request.user.uuid,
      );
      return this.resolvePhotoUrl(event);
    } catch (error) {
      if (photo !== undefined && photoKey !== null) {
        await this.storageService.delete(bucket, photoKey);
      }
      throw error;
    }
  }

  @Get(":eventId")
  @RequirePermission(PermissionType.MANAGE_EVENT)
  @ApiOperation({ summary: "Get event by UUID" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiOkResponse({ description: "The event", type: Event })
  async findOne(
    @Param("eventId", ParseUUIDPipe) eventUUID: string,
  ): Promise<Event> {
    return this.resolvePhotoUrl(await this.eventsService.findOne(eventUUID));
  }

  @Patch(":eventId")
  @RequirePermission(PermissionType.MANAGE_EVENT)
  @UploadPhoto()
  @ApiOperation({ summary: "Update event by UUID" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiOkResponse({ description: "The updated event", type: Event })
  async update(
    @Param("eventId", ParseUUIDPipe) eventUUID: string,
    @UploadedFile()
    photo: Express.Multer.File | undefined,
    @Body() eventDto: EventUpdateDto,
    @Request() request: { user: AuthUser },
  ): Promise<Event> {
    let photoKey: string | null | undefined;
    let previousPhotoKey: string | null = null;
    const bucket = this.configService.getOrThrow<string>("S3_BUCKET_EVENTS");

    if (photo !== undefined) {
      const existing = await this.eventsService.findOne(eventUUID);
      previousPhotoKey = existing.photoUrl;
      photoKey = await this.storageService.upload(bucket, photo);
    } else if (eventDto.photoUrl === null) {
      const existing = await this.eventsService.findOne(eventUUID);
      previousPhotoKey = existing.photoUrl;
      photoKey = null;
    }

    eventDto.applyUserTypeRestrictions?.(request.user.type);

    let event: Event;
    try {
      event = await this.eventsService.update(eventUUID, eventDto, photoKey);
    } catch (error) {
      if (photoKey != null) {
        await this.storageService.delete(bucket, photoKey);
      }
      throw error;
    }

    if (previousPhotoKey !== null) {
      await this.storageService.delete(bucket, previousPhotoKey);
    }
    return this.resolvePhotoUrl(event);
  }

  @Delete(":eventId")
  // TODO: jakaś inna permisja jak będą współorganizatorzy
  @RequirePermission(PermissionType.MANAGE_EVENT)
  @ApiOperation({ summary: "Delete event by UUID" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiNoContentResponse({ description: "No content" })
  @HttpCode(204)
  async remove(
    @Param("eventId", ParseUUIDPipe) eventUUID: string,
  ): Promise<Event> {
    const existing = await this.eventsService.findOne(eventUUID);
    const removed = await this.eventsService.remove(eventUUID);
    if (existing.photoUrl !== null) {
      await this.storageService.delete(
        this.configService.getOrThrow("S3_BUCKET_EVENTS"),
        existing.photoUrl,
      );
    }
    return removed;
  }
}
