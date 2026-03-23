import { Response } from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { RequirePermission } from "src/auth/permissions.decorator";
import { PermissionsGuard } from "src/auth/permissions.guard";
import { PermissionType } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

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
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { ParticipantBulkUpdateDto } from "./dto/participant-bulk-update.dto";
import { ParticipantsService } from "./participants.service";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiTags("Participants Attributes")
@Controller("events/:eventId/participants")
export class ParticipantsAttributesController {
  constructor(
    private readonly participantsService: ParticipantsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(":participantId/attributes/:attributeId/download")
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ApiOperation({ summary: "Download an attribute file" })
  async downloadFile(
    @Param("eventId", ParseUUIDPipe) eventUuid: string,
    @Param("participantId", ParseUUIDPipe) participantUuid: string,
    @Param("attributeId", ParseUUIDPipe) attributeUuid: string,
    @Res() res: Response,
  ) {
    const participantAttribute =
      await this.prisma.participantAttribute.findFirst({
        where: {
          participantUuid,
          attributeUuid,
          participant: { eventUuid },
        },
      });

    if (!participantAttribute?.value) {
      throw new NotFoundException("Attribute doesn't have a file");
    }

    const filename = participantAttribute.value;
    const filePath = join(process.cwd(), "uploads", "attributes", filename);

    if (existsSync(filePath)) {
      res.download(filePath);
    } else {
      throw new NotFoundException("File not found on server");
    }
  }

  @Patch("attributes/:attributeId/bulk-update")
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ApiOperation({ summary: "Bulk update participants attributes" })
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
