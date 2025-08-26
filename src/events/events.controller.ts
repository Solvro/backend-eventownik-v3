import { Event } from "@prisma/client";
import { QueryListingDto } from "src/prisma/dto/query-listing.dto";
import { PrismaService } from "src/prisma/prisma.service";

import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

@Controller("events")
@ApiTags("Events")
export class EventsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiResponse({ status: 200, description: "Hello World!" })
  @ApiOperation({ summary: "Hello World Endpoint" })
  index(@Query() query: QueryListingDto): QueryListingDto {
    return query;
    // return await this.prisma.event.findMany();
  }
}
