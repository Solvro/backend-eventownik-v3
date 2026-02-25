import { PageDto } from "src/common/dto/page.dto";

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
  UploadedFile,
} from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { EventCreateDto } from "./dto/event-create.dto";
import { EventListingDto } from "./dto/event-listing.dto";
import { EventUpdateDto } from "./dto/event-update.dto";
import { Event } from "./entities/event.entity";
import { EventsService } from "./events.service";
import { UploadPhoto } from "./utils/upload-photo.decorator";

@ApiTags("Events")
@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
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
  ): Promise<Event> {
    let photoUrl: string | null = null;
    if (photo !== undefined) {
      photoUrl = `/uploads/events/${photo.filename}`;
    }
    return this.eventsService.create(eventDto, photoUrl);
  }

  @Get(":eventUUID")
  @ApiOperation({ summary: "Get event by UUID" })
  @ApiOkResponse({ description: "The event", type: Event })
  async findOne(
    @Param("eventUUID", ParseUUIDPipe) eventUUID: string,
  ): Promise<Event> {
    return this.eventsService.findOne(eventUUID);
  }

  @Patch(":eventUUID")
  @UploadPhoto()
  @ApiOperation({ summary: "Update event by UUID" })
  @ApiOkResponse({ description: "The updated event", type: Event })
  async update(
    @Param("eventUUID", ParseUUIDPipe) eventUUID: string,
    @UploadedFile()
    photo: Express.Multer.File | undefined,
    @Body() eventDto: EventUpdateDto,
  ): Promise<Event> {
    let photoUrl: string | null = null;
    if (photo !== undefined) {
      photoUrl = `/uploads/events/${photo.filename}`;
    }
    return this.eventsService.update(eventUUID, eventDto, photoUrl);
  }

  @Delete(":eventUUID")
  @ApiOperation({ summary: "Delete event by UUID" })
  @ApiOkResponse({ description: "No content" })
  @HttpCode(204)
  async remove(
    @Param("eventUUID", ParseUUIDPipe) eventUUID: string,
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
