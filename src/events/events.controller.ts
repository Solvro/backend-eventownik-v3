import { PageDto } from "src/common/dto/page.dto";
import { Event } from "src/generated/prisma/client";

import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";

import { EventListingDto } from "./dto/event-listing.dto";
import { EventsService } from "./events.service";

@ApiTags("Events")
@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({ summary: "Get list of events with pagination and filtering" })
  @ApiResponse({
    status: 200,
    description: "List of events",
    type: PageDto<Event>,
  })
  async findAll(@Query() dto: EventListingDto): Promise<PageDto<Event>> {
    return this.eventsService.findAll(dto);
  }

  @Get(":eventId")
  @ApiOperation({ summary: "Get event by ID" })
  @ApiResponse({
    status: 200,
    description: "Event details",
    type: Event,
  })
  @ApiResponse({
    status: 404,
    description: "Event not found",
  })
  async findOne(
    @Param("eventId", ParseUUIDPipe) eventId: string,
  ): Promise<Event> {
    return this.eventsService.findOne(eventId);
  }
}
