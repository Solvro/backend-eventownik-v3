import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { RequirePermission } from "src/auth/permissions.decorator";
import { PermissionsGuard } from "src/auth/permissions.guard";
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
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { ParticipantCreateDto } from "./dto/participant-create.dto";
import { ParticipantListingDto } from "./dto/participant-listing.dto";
import { ParticipantUpdateDto } from "./dto/participant-update.dto";
import { UnregisterManyDto } from "./dto/unregister-many.dto";
import { ParticipantsService } from "./participants.service";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiTags("Participants")
@Controller("events/:eventId/participants")
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Get()
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ApiOperation({ summary: "Get all participants for a specific event" })
  async index(
    @Param("eventId", ParseUUIDPipe) eventUuid: string,
    @Query() query: ParticipantListingDto,
  ) {
    return this.participantsService.findAll(eventUuid, query);
  }

  @Post()
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ApiOperation({ summary: "Create a new participant" })
  async store(
    @Param("eventId", ParseUUIDPipe) eventUuid: string,
    @Body() dto: ParticipantCreateDto,
  ) {
    return this.participantsService.createParticipant(eventUuid, dto);
  }

  @Get(":id")
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ApiOperation({ summary: "Get a participant by UUID" })
  async show(
    @Param("eventId", ParseUUIDPipe) eventUuid: string,
    @Param("id", ParseUUIDPipe) participantUuid: string,
  ) {
    return this.participantsService.findOne(eventUuid, participantUuid);
  }

  @Patch(":id")
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ApiOperation({ summary: "Update a participant" })
  async update(
    @Param("eventId", ParseUUIDPipe) eventUuid: string,
    @Param("id", ParseUUIDPipe) participantUuid: string,
    @Body() dto: ParticipantUpdateDto,
  ) {
    return this.participantsService.updateParticipant(
      eventUuid,
      participantUuid,
      dto,
    );
  }

  @Delete(":id")
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ApiOperation({ summary: "Delete a participant" })
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
