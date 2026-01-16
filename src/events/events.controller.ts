import { PageDto } from "src/common/dto/page.dto";

import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { EventListingDto } from "./dto/event-listing.dto";
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
    return this.eventsService.findAll(dto);
  }

  @Get(":eventId")
  @ApiOperation({ summary: "Get event by ID" })
  @ApiOkResponse({ description: "The event", type: Event })
  async findOne(
    @Param("eventId", ParseUUIDPipe) eventId: string,
  ): Promise<Event> {
    return this.eventsService.findOne(eventId);
  }
}
