import { ApiPaginatedResponse } from "src/common/decorators/api-paginated-response.decorator";
import { PageDto } from "src/common/dto/page.dto";
import { StorageService } from "src/storage/storage.service";

import { Controller, Get, Param, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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
  constructor(
    private readonly eventsService: EventsService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  private resolvePhotoUrl(event: Event): Event {
    if (event.photoUrl === null) {
      return event;
    }
    return {
      ...event,
      photoUrl: this.storageService.getUrl(
        this.configService.getOrThrow("S3_BUCKET_EVENTS"),
        event.photoUrl,
      ),
    };
  }

  @Get("")
  @ApiOperation({
    summary: "Get list of public events with pagination and filtering",
  })
  @ApiPaginatedResponse(Event)
  async findAllPublic(@Query() dto: EventListingDto): Promise<PageDto<Event>> {
    const result = await this.eventsService.findAllPublic(dto);
    return new PageDto<Event>(
      result.data.map((e) => this.resolvePhotoUrl(e as Event)),
      result.meta,
    );
  }

  @Get(":slug")
  @ApiOperation({ summary: "Get public event by slug" })
  @ApiParam({ name: "slug", description: "Event slug" })
  @ApiOkResponse({ description: "The public event", type: Event })
  async findOnePublic(@Param("slug") slug: string): Promise<Event> {
    return this.resolvePhotoUrl(await this.eventsService.findOnePublic(slug));
  }
}
