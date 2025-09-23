import { Event } from "@prisma/client";

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";

import { QueryListingDto } from "../prisma/dto/query-listing.dto";
import { CreateEventDto } from "./dtos/create-event.dto";
import { UpdateEventDto } from "./dtos/update-event.dto";
import { EventsService } from "./events.service";

@Controller("api/v1")
@ApiTags("Events")
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Get("internal/events")
  @ApiOperation({ summary: "Events Endpoint" })
  @ApiResponse({ status: 200, description: "List of events" })
  @ApiQuery({ type: QueryListingDto, required: false })
  async index(@Query() query: QueryListingDto): Promise<Event[]> {
    return await this.eventsService.index(query);
  }

  @Get("internal/events/:uuid")
  @ApiOperation({ summary: "Show Event Endpoint" })
  @ApiResponse({ status: 200, description: "Show Event with provided ID" })
  async show(@Param("uuid") uuid: string): Promise<Event> {
    return await this.eventsService.show(uuid);
  }

  @Get("external/events/:slug")
  @ApiOperation({ summary: "Show Basic Event Details by Slug Endpoint" })
  @ApiResponse({
    status: 200,
    description: "Show Basic Event Details with provided Slug",
  })
  async publicShow(@Param("slug") slug: string) {
    return await this.eventsService.publicShow(slug);
  }

  @Post("internal/events")
  @ApiOperation({ summary: "Create Event Endpoint" })
  @ApiResponse({ status: 201, description: "Returns created event" })
  async create(@Body() createEventDto: CreateEventDto) {
    return await this.eventsService.create(createEventDto);
  }

  @Put("internal/events/:uuid")
  @ApiOperation({ summary: "Update Event Endpoint" })
  @ApiResponse({ status: 200, description: "Returns updated event" })
  async update(
    @Param("uuid") uuid: string,
    @Body() updateEventDto: UpdateEventDto,
  ) {
    return await this.eventsService.update(uuid, updateEventDto);
  }

  @Delete("internal/events/:uuid")
  @ApiOperation({ summary: "Delete Event Endpoint" })
  @ApiResponse({ status: 204, description: "No content" })
  async remove(@Param("uuid") uuid: string) {
    return await this.eventsService.remove(uuid);
  }
}
