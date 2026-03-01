import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { AuthUser } from "src/auth/jwt.strategy";
import { RequirePermission } from "src/auth/permissions.decorator";
import { PermissionsGuard } from "src/auth/permissions.guard";
import { PageDto } from "src/common/dto/page.dto";
import { PermissionType } from "src/generated/prisma/enums";

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
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { EventCreateDto } from "./dto/event-create.dto";
import { EventListingDto } from "./dto/event-listing.dto";
import { EventUpdateDto } from "./dto/event-update.dto";
import { Event } from "./entities/event.entity";
import { EventsService } from "./events.service";
import { UploadPhoto } from "./utils/upload-photo.decorator";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiTags("Events")
@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @RequirePermission(PermissionType.MANAGE_ALL)
  @ApiOperation({ summary: "Get list of events with pagination and filtering" })
  @ApiOkResponse({ description: "List of events", type: PageDto<Event> })
  async findAll(@Query() dto: EventListingDto): Promise<PageDto<Event>> {
    // z auth'em, zwracać swoje eventy / wszystkie dla superadmina
    return this.eventsService.findAll(dto);
  }

  // TODO: usuwanie zdjęcia z serwera przy aktualizacji, usuwaniu eventu i gdy nie przejdzie walidacji, to samo dla PUT
  @Post()
  @UploadPhoto()
  @ApiOperation({ summary: "Create a new event" })
  @ApiOkResponse({ description: "The created event", type: Event })
  async create(
    @UploadedFile()
    photo: Express.Multer.File | undefined,
    @Body() eventDto: EventCreateDto,
    @Request() request: { user: AuthUser },
  ): Promise<Event> {
    let photoUrl = eventDto.photoUrl ?? null;

    if (photo !== undefined) {
      photoUrl = `/uploads/events/${photo.filename}`;
    }

    return this.eventsService.create(eventDto, photoUrl, request.user.uuid);
  }

  @Get(":eventId")
  @RequirePermission(PermissionType.MANAGE_EVENT)
  @ApiOperation({ summary: "Get event by UUID" })
  @ApiOkResponse({ description: "The event", type: Event })
  async findOne(
    @Param("eventId", ParseUUIDPipe) eventUUID: string,
  ): Promise<Event> {
    return this.eventsService.findOne(eventUUID);
  }

  @Patch(":eventId")
  @RequirePermission(PermissionType.MANAGE_EVENT)
  @UploadPhoto()
  @ApiOperation({ summary: "Update event by UUID" })
  @ApiOkResponse({ description: "The updated event", type: Event })
  async update(
    @Param("eventId", ParseUUIDPipe) eventUUID: string,
    @UploadedFile()
    photo: Express.Multer.File | undefined,
    @Body() eventDto: EventUpdateDto,
  ): Promise<Event> {
    let photoUrl = eventDto.photoUrl ?? null;

    if (photo !== undefined) {
      photoUrl = `/uploads/events/${photo.filename}`;
    }
    return this.eventsService.update(eventUUID, eventDto, photoUrl);
  }

  @Delete(":eventId")
  // TODO: jakaś inna permisja jak będą współorganizatorzy
  @RequirePermission(PermissionType.MANAGE_EVENT)
  @ApiOperation({ summary: "Delete event by UUID" })
  @ApiOkResponse({ description: "No content" })
  @HttpCode(204)
  async remove(
    @Param("eventId", ParseUUIDPipe) eventUUID: string,
  ): Promise<Event> {
    return this.eventsService.remove(eventUUID);
  }
}

@ApiTags("Events")
@Controller("public/events")
export class PublicEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get("")
  @ApiOperation({
    summary: "Get list of public events with pagination and filtering",
  })
  @ApiOkResponse({ description: "List of public events", type: PageDto<Event> })
  async findAllPublic(@Query() dto: EventListingDto): Promise<PageDto<Event>> {
    return this.eventsService.findAllPublic(dto);
  }

  @Get(":slug")
  @ApiOperation({ summary: "Get public event by slug" })
  @ApiOkResponse({ description: "The public event", type: Event })
  async findOnePublic(@Param("slug") slug: string): Promise<Event> {
    return this.eventsService.findOnePublic(slug);
  }
}
