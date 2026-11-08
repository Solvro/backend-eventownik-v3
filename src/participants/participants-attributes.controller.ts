import { Response } from "express";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { RequirePermission } from "src/auth/permissions.decorator";
import { PermissionsGuard } from "src/auth/permissions.guard";
import { PermissionType } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";
import { StorageService } from "src/storage/storage.service";

import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiFoundResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { ParticipantBulkUpdateDto } from "./dto/participant-bulk-update.dto";
import { ParticipantsService } from "./participants.service";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
@ApiTags("Participants Attributes")
@ApiUnauthorizedResponse({ description: "Unauthorized" })
@ApiForbiddenResponse({ description: "Forbidden - insufficient permissions" })
@Controller("events/:eventId/participants")
export class ParticipantsAttributesController {
  constructor(
    private readonly participantsService: ParticipantsService,
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  @Get(":participantId/attributes/:attributeId/download")
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ApiOperation({ summary: "Download an attribute file" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "participantId", description: "UUID of the participant" })
  @ApiParam({ name: "attributeId", description: "UUID of the attribute" })
  @ApiFoundResponse({ description: "Redirect to the file in storage" })
  @ApiNotFoundResponse({ description: "Attribute file not found" })
  async downloadFile(
    @Param("eventId", ParseUUIDPipe) eventUuid: string,
    @Param("participantId", ParseUUIDPipe) participantUuid: string,
    @Param("attributeId", ParseUUIDPipe) attributeUuid: string,
    @Res() response: Response,
  ) {
    const participantAttribute =
      await this.prisma.participantAttribute.findFirst({
        where: {
          participantUuid,
          attributeUuid,
          participant: { eventUuid },
        },
      });

    if (
      participantAttribute?.value == null ||
      typeof participantAttribute.value !== "string" ||
      participantAttribute.value.length === 0
    ) {
      throw new NotFoundException("Attribute doesn't have a file");
    }

    const fileUrl = this.storageService.getUrl(
      this.configService.getOrThrow<string>("S3_BUCKET_FORMS"),
      participantAttribute.value,
    );

    response.redirect(fileUrl);
  }

  @Patch("attributes/:attributeId/bulk-update")
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ApiOperation({ summary: "Bulk update participants attributes" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "attributeId", description: "UUID of the attribute" })
  @ApiNoContentResponse({ description: "Attributes updated" })
  @ApiNotFoundResponse({ description: "Attribute or Event not found" })
  @HttpCode(204)
  async bulkUpdate(
    @Param("eventId", ParseUUIDPipe) eventUuid: string,
    @Param("attributeId", ParseUUIDPipe) attributeUuid: string,
    @Body() dto: ParticipantBulkUpdateDto,
  ) {
    return this.participantsService.bulkUpdateAttributes(
      eventUuid,
      attributeUuid,
      dto.newValue,
      dto.participantIds,
    );
  }
}
