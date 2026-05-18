import { Response } from "express";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { RequirePermission } from "src/auth/permissions.decorator";
import { PermissionsGuard } from "src/auth/permissions.guard";
import { PermissionType } from "src/generated/prisma/enums";

import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { ExportParticipantsQueryDto } from "./dto/export-participants-query.dto";
import { ImportExportService } from "./import-export.service";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiTags("Import/Export")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "Unauthorized" })
@ApiForbiddenResponse({ description: "Forbidden - insufficient permissions" })
@Controller("events/:eventId/import-export")
export class ImportExportController {
  constructor(private readonly importExportService: ImportExportService) {}

  @Get("participants")
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ApiOperation({ summary: "Export participants with selected attributes" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiProduces(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  )
  @ApiQuery({
    name: "participantIds",
    required: false,
    type: String,
    isArray: true,
    description:
      "Optional participant UUIDs to export. If omitted, all event participants are exported.",
  })
  @ApiQuery({
    name: "attributeIds",
    required: false,
    type: String,
    isArray: true,
    description:
      "Optional attribute UUIDs to export. If omitted, all event attributes are exported.",
  })
  @ApiQuery({
    name: "format",
    required: false,
    enum: ["xlsx"],
    description: "Export format. Defaults to xlsx.",
  })
  @ApiOkResponse({
    description: "Participants exported as downloadable file",
    schema: {
      type: "string",
      format: "binary",
    },
  })
  @ApiNotFoundResponse({ description: "Event not found" })
  async exportParticipants(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Query() query: ExportParticipantsQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const exportedFile = await this.importExportService.exportParticipants(
      eventId,
      query,
    );

    response.setHeader("Content-Type", exportedFile.mimeType);
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${exportedFile.fileName}"`,
    );
    response.send(exportedFile.content);
  }
}
