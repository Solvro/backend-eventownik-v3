import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import { Participant } from "./entities/participant.entity";
import { ParticipantsService } from "./participants.service";

@ApiTags("Public Participants")
@Controller("public/events/:eventId/participants")
export class PublicParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Get(":participantId")
  @ApiOperation({ summary: "Get public participant" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "participantId", description: "UUID of the participant" })
  @ApiOkResponse({ type: Participant })
  @ApiNotFoundResponse({ description: "Participant not found" })
  async findOne(
    @Param("eventId", ParseUUIDPipe) eventUuid: string,
    @Param("participantId", ParseUUIDPipe) participantUuid: string,
    @Query("attributes") attributes?: string[],
  ) {
    return this.participantsService.findOnePublic(
      eventUuid,
      participantUuid,
      attributes ?? [],
    );
  }
}
