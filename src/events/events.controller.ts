import { Event } from "@prisma/client";
import { QueryListingDto } from "src/prisma/dto/query-listing.dto";
import { PrismaService } from "src/prisma/prisma.service";

import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";

@Controller("events")
@ApiTags("Events")
export class EventsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "Events Endpoint" })
  @ApiResponse({ status: 200, description: "List of events" })
  @ApiQuery({ type: QueryListingDto, required: false })
  async index(@Query() query: QueryListingDto): Promise<Event[]> {
    return await this.prisma.event.findMany(query.toPrisma("Event"));
  }
}
