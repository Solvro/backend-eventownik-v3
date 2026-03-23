import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { ParticipantsService } from "./participants.service";

@ApiTags("Public Participants")
@Controller("public/events/:eventId/participants")
export class PublicParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Get(":participantId")
  @ApiOperation({ summary: "Get public participant" })
  async index(
    @Param("eventId", ParseUUIDPipe) eventUuid: string,
    @Param("participantId", ParseUUIDPipe) participantUuid: string,
    @Query("attributes") attributes?: string[],
  ) {
    return this.participantsService.findOnePublic(
      eventUuid,
      participantUuid,
      attributes || [],
    );
  }
}
