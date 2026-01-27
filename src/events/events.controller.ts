import { PageDto } from "src/common/dto/page.dto";

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { EventCreateDto } from "./dto/event-create.dto";
import { EventListingDto } from "./dto/event-listing.dto";
import { EventUpdateDto } from "./dto/event-update.dto";
import { Event } from "./entities/event.entity";
import { EventsService } from "./events.service";

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

  @Get("public")
  @ApiOperation({
    summary: "Get list of public events with pagination and filtering",
  })
  @ApiOkResponse({ description: "List of public events", type: PageDto<Event> })
  async findAllPublic(@Query() dto: EventListingDto): Promise<PageDto<Event>> {
    return this.eventsService.findAllPublic(dto);
  }

  //TODO: photo service
  @Post()
  @ApiOperation({ summary: "Create a new event" })
  @ApiOkResponse({ description: "The created event", type: Event })
  async create(@Body() eventDto: EventCreateDto): Promise<Event> {
    return this.eventsService.create(eventDto);
  }

  @Get(":eventUUID")
  @ApiOperation({ summary: "Get event by UUID" })
  @ApiOkResponse({ description: "The event", type: Event })
  async findOne(
    @Param("eventUUID", ParseUUIDPipe) eventUUID: string,
  ): Promise<Event> {
    return this.eventsService.findOne(eventUUID);
  }

  @Get("public/:eventUUID")
  @ApiOperation({ summary: "Get public event by UUID" })
  @ApiOkResponse({ description: "The public event", type: Event })
  async findOnePublic(
    @Param("eventUUID", ParseUUIDPipe) eventUUID: string,
  ): Promise<Event> {
    return this.eventsService.findOnePublic(eventUUID);
  }

  @Put(":eventUUID")
  @ApiOperation({ summary: "Update event by UUID" })
  @ApiOkResponse({ description: "The updated event", type: Event })
  async update(
    @Param("eventUUID", ParseUUIDPipe) eventUUID: string,
    @Body() eventDto: EventUpdateDto,
  ): Promise<Event> {
    return this.eventsService.update(eventUUID, eventDto);
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
