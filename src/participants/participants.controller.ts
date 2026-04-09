import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { RequirePermission } from "src/auth/permissions.decorator";
import { PermissionsGuard } from "src/auth/permissions.guard";
import { PageDto } from "src/common/dto/page.dto";
import { PermissionType } from "src/generated/prisma/enums";

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiConflictResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from "@nestjs/swagger";

import { ParticipantCreateDto } from "./dto/participant-create.dto";
import { ParticipantListingDto } from "./dto/participant-listing.dto";
import { ParticipantUpdateDto } from "./dto/participant-update.dto";
import { UnregisterManyDto } from "./dto/unregister-many.dto";
import { Participant } from "./entities/participant.entity";
import { ParticipantsService } from "./participants.service";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiTags("Participants")
@ApiExtraModels(PageDto, Participant)
@Controller("events/:eventId/participants")
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Get()
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ApiOperation({ summary: "Get all participants for a specific event" })
  @ApiOkResponse({
    description: "Paginated list of participants",
    schema: {
      allOf: [
        { $ref: getSchemaPath(PageDto) },
        {
          properties: {
            data: {
              type: "array",
              items: { $ref: getSchemaPath(Participant) },
            },
          },
        },
      ],
    },
  })
  async index(
    @Param("eventId", ParseUUIDPipe) eventUuid: string,
    @Query() query: ParticipantListingDto,
  ): Promise<PageDto<Participant>> {
    return this.participantsService.findAll(eventUuid, query);
  }

  @Post()
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ApiOperation({ summary: "Create a new participant" })
  @ApiResponse({
    status: 201,
    description: "The participant has been successfully created.",
    type: Participant,
  })
  @ApiConflictResponse({ description: "Email already exists in this event" })
  @ApiNotFoundResponse({ description: "Event not found" })
  async store(
    @Param("eventId", ParseUUIDPipe) eventUuid: string,
    @Body() dto: ParticipantCreateDto,
  ): Promise<Participant> {
    return this.participantsService.createParticipant(eventUuid, dto);
  }

  @Get(":id")
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ApiOperation({ summary: "Get a participant by UUID" })
  @ApiOkResponse({ type: Participant })
  @ApiNotFoundResponse({ description: "Participant not found" })
  async show(
    @Param("eventId", ParseUUIDPipe) eventUuid: string,
    @Param("id", ParseUUIDPipe) participantUuid: string,
  ): Promise<Participant> {
    return this.participantsService.findOne(eventUuid, participantUuid);
  }

  @Patch(":id")
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ApiOperation({ summary: "Update a participant" })
  @ApiOkResponse({ type: Participant })
  @ApiNotFoundResponse({ description: "Participant or Attribute not found" })
  @ApiConflictResponse({ description: "Email conflict" })
  async update(
    @Param("eventId", ParseUUIDPipe) eventUuid: string,
    @Param("id", ParseUUIDPipe) participantUuid: string,
    @Body() dto: ParticipantUpdateDto,
  ): Promise<Participant> {
    return this.participantsService.updateParticipant(
      eventUuid,
      participantUuid,
      dto,
    );
  }

  @Delete(":id")
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ApiOperation({ summary: "Delete a participant" })
  @ApiResponse({ status: 204, description: "Participant deleted" })
  @ApiNotFoundResponse({ description: "Participant not found" })
  @HttpCode(204)
  async destroy(
    @Param("eventId", ParseUUIDPipe) eventUuid: string,
    @Param("id", ParseUUIDPipe) participantUuid: string,
  ) {
    return this.participantsService.unregister(eventUuid, participantUuid);
  }

  @Delete(":id/unregister")
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ApiOperation({ summary: "Unregister a participant from an event" })
  @ApiResponse({ status: 204, description: "Participant unregistered" })
  @ApiNotFoundResponse({ description: "Participant not found" })
  @HttpCode(204)
  async unregister(
    @Param("eventId", ParseUUIDPipe) eventUuid: string,
    @Param("id", ParseUUIDPipe) participantUuid: string,
  ) {
    return this.participantsService.unregister(eventUuid, participantUuid);
  }

  @Post("unregister-many")
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ApiOperation({ summary: "Unregister many participants from an event" })
  @ApiResponse({ status: 204, description: "Participants unregistered" })
  @HttpCode(204)
  async unregisterMany(
    @Param("eventId", ParseUUIDPipe) eventUuid: string,
    @Body() dto: UnregisterManyDto,
  ) {
    return this.participantsService.unregisterMany(
      eventUuid,
      dto.participantsToUnregisterIds,
    );
  }
}
