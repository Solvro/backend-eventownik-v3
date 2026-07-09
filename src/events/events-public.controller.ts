import { ApiPaginatedResponse } from "src/common/decorators/api-paginated-response.decorator";
import { PageDto } from "src/common/dto/page.dto";

import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import { EventListingDto } from "./dto/event-listing.dto";
import { Event } from "./entities/event.entity";
import { EventsService } from "./events.service";

@ApiTags("Public")
@Controller("public/events")
export class PublicEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get("")
  @ApiOperation({
    summary: "Get list of public events with pagination and filtering",
  })
  @ApiPaginatedResponse(Event)
  async findAllPublic(@Query() dto: EventListingDto): Promise<PageDto<Event>> {
    return this.eventsService.findAllPublic(dto);
  }

  @Get(":slug")
  @ApiOperation({ summary: "Get public event by slug" })
  @ApiParam({ name: "slug", description: "Event slug" })
  @ApiOkResponse({ description: "The public event", type: Event })
  async findOnePublic(@Param("slug") slug: string): Promise<Event> {
    return this.eventsService.findOnePublic(slug);
  }
}
