import type { AuditActor } from "src/audit-log/audit-log.types";
import { CurrentAuditActor } from "src/audit-log/current-audit-actor.decorator";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { RequirePermission } from "src/auth/permissions.decorator";
import { PermissionsGuard } from "src/auth/permissions.guard";
import { ApiPaginatedResponse } from "src/common/decorators/api-paginated-response.decorator";
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
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { ParticipantCreateDto } from "./dto/participant-create.dto";
import { ParticipantListingDto } from "./dto/participant-listing.dto";
import { ParticipantUpdateDto } from "./dto/participant-update.dto";
import { UnregisterManyDto } from "./dto/unregister-many.dto";
import { Participant } from "./entities/participant.entity";
import { ParticipantsService } from "./participants.service";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiTags("Participants")
@ApiBearerAuth()
@ApiExtraModels(PageDto, Participant)
@ApiUnauthorizedResponse({ description: "Unauthorized" })
@ApiForbiddenResponse({ description: "Forbidden - insufficient permissions" })
@Controller("events/:eventId/participants")
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Get()
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ApiOperation({ summary: "Get all participants for a specific event" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiPaginatedResponse(Participant)
  async findAll(
    @Param("eventId", ParseUUIDPipe) eventUuid: string,
    @Query() query: ParticipantListingDto,
  ): Promise<PageDto<Participant>> {
    return this.participantsService.findAll(eventUuid, query);
  }

  @Post()
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ApiOperation({ summary: "Create a new participant" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiCreatedResponse({
    description: "The participant has been successfully created.",
    type: Participant,
  })
  @ApiConflictResponse({ description: "Email already exists in this event" })
  @ApiNotFoundResponse({ description: "Event not found" })
  async create(
    @Param("eventId", ParseUUIDPipe) eventUuid: string,
    @Body() dto: ParticipantCreateDto,
    @CurrentAuditActor() actor: AuditActor,
  ): Promise<Participant> {
    return this.participantsService.create(eventUuid, dto, actor);
  }

  @Get(":id")
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ApiOperation({ summary: "Get a participant by UUID" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "id", description: "UUID of the participant" })
  @ApiOkResponse({ type: Participant })
  @ApiNotFoundResponse({ description: "Participant not found" })
  async findOne(
    @Param("eventId", ParseUUIDPipe) eventUuid: string,
    @Param("id", ParseUUIDPipe) participantUuid: string,
  ): Promise<Participant> {
    return this.participantsService.findOne(eventUuid, participantUuid);
  }

  @Patch(":id")
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ApiOperation({
    summary: "Update a participant",
    description:
      "Omitted fields and attributes are kept. An attribute sent with a null value is cleared, and a file or drawing it held is deleted from storage.",
  })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "id", description: "UUID of the participant" })
  @ApiOkResponse({ type: Participant })
  @ApiNotFoundResponse({ description: "Participant or Attribute not found" })
  @ApiConflictResponse({ description: "Email conflict" })
  async update(
    @Param("eventId", ParseUUIDPipe) eventUuid: string,
    @Param("id", ParseUUIDPipe) participantUuid: string,
    @Body() dto: ParticipantUpdateDto,
    @CurrentAuditActor() actor: AuditActor,
  ): Promise<Participant> {
    return this.participantsService.update(eventUuid, participantUuid, dto, {
      actor,
    });
  }

  @Delete(":id")
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ApiOperation({ summary: "Delete a participant" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "id", description: "UUID of the participant" })
  @ApiNoContentResponse({ description: "Participant deleted" })
  @ApiNotFoundResponse({ description: "Participant not found" })
  @HttpCode(204)
  async remove(
    @Param("eventId", ParseUUIDPipe) eventUuid: string,
    @Param("id", ParseUUIDPipe) participantUuid: string,
    @CurrentAuditActor() actor: AuditActor,
  ) {
    return this.participantsService.remove(eventUuid, participantUuid, actor);
  }

  @Delete(":id/unregister")
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ApiOperation({ summary: "Unregister a participant from an event" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "id", description: "UUID of the participant" })
  @ApiNoContentResponse({ description: "Participant unregistered" })
  @ApiNotFoundResponse({ description: "Participant not found" })
  @HttpCode(204)
  async unregister(
    @Param("eventId", ParseUUIDPipe) eventUuid: string,
    @Param("id", ParseUUIDPipe) participantUuid: string,
    @CurrentAuditActor() actor: AuditActor,
  ) {
    return this.participantsService.remove(eventUuid, participantUuid, actor);
  }

  @Post("unregister-many")
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ApiOperation({ summary: "Unregister many participants from an event" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiNoContentResponse({ description: "Participants unregistered" })
  @HttpCode(204)
  async unregisterMany(
    @Param("eventId", ParseUUIDPipe) eventUuid: string,
    @Body() dto: UnregisterManyDto,
    @CurrentAuditActor() actor: AuditActor,
  ) {
    return this.participantsService.removeMany(
      eventUuid,
      dto.participantsToUnregisterIds,
      actor,
    );
  }
}
