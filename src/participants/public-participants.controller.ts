import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";

import { Participant } from "./entities/participant.entity";
import { ParticipantsService } from "./participants.service";

@ApiTags("Public")
@Controller("public/events/:eventSlug/participants")
export class PublicParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Get(":participantId")
  @ApiOperation({ summary: "Get public participant" })
  @ApiParam({ name: "eventSlug", description: "Slug of the event" })
  @ApiParam({ name: "participantId", description: "UUID of the participant" })
  @ApiQuery({
    name: "attributes",
    required: false,
    type: [String],
    description: "List of attributes to include",
  })
  @ApiOkResponse({ type: Participant })
  @ApiNotFoundResponse({ description: "Participant not found" })
  async findOne(
    @Param("eventSlug") eventSlug: string,
    @Param("participantId", ParseUUIDPipe) participantUuid: string,
    @Query("attributes") attributes?: string | string[],
  ) {
    const normalizedAttributes = Array.isArray(attributes)
      ? attributes
      : attributes === undefined
        ? []
        : [attributes];
    return this.participantsService.findOnePublic(
      eventSlug,
      participantUuid,
      normalizedAttributes,
    );
  }
}
