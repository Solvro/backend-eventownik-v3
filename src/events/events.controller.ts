import { PageDto } from "src/common/dto/page.dto";
import { Event } from "src/generated/prisma/client";
import { QueryListingDto } from "src/prisma/dto/query-listing.dto";

import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";

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
  @ApiQuery({ type: EventListingDto, required: false })
  async findAll(@Query() dto: EventListingDto): Promise<PageDto<Event>> {
    return this.eventsService.findAll(dto);
  }

  //   @Get()
  //   @ApiOperation({ summary: "Events Endpoint" })
  //   @ApiResponse({ status: 200, description: "List of events" })
  //   @ApiQuery({ type: QueryListingDto, required: false })
  //   async index(@Query() query: QueryListingDto): Promise<Event[]> {
  //     return await this.prisma.event.findMany(query.toPrisma("Event"));
  //   }
}
