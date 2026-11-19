import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import { TicketPublic } from "./entities/ticket-public.entity";
import { TicketPublicService } from "./ticket-public.service";

@ApiTags("Public")
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller("public/events/:eventSlug/tickets")
export class TicketPublicController {
  constructor(private readonly ticketPublicService: TicketPublicService) {}

  @Get(":token")
  @ApiOperation({ summary: "Get the ticket page data for a participant token" })
  @ApiParam({ name: "eventSlug", description: "Slug of the event" })
  @ApiParam({ name: "token", description: "Ticket token from the email link" })
  @ApiOkResponse({ type: TicketPublic })
  @ApiNotFoundResponse({
    description: "Unknown token, wrong event or event without tickets",
  })
  async findByToken(
    @Param("eventSlug") eventSlug: string,
    @Param("token") token: string,
  ): Promise<TicketPublic> {
    return this.ticketPublicService.findByToken(eventSlug, token);
  }
}
