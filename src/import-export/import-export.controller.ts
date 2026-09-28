import { Request, Response } from "express";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { RequirePermission } from "src/auth/permissions.decorator";
import { PermissionsGuard } from "src/auth/permissions.guard";
import { PermissionType } from "src/generated/prisma/enums";

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
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
import { ParticipantsImportResultDto } from "./dto/participants-import-result.dto";
import { ParticipantsImportDto } from "./dto/participants-import.dto";
import { ImportExportService } from "./import-export.service";
import { ImportParticipants } from "./utils/xlsx-upload.decorator";

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

  @Post("participants")
  @HttpCode(200)
  @RequirePermission(PermissionType.MANAGE_PARTICIPANT)
  @ImportParticipants()
  @ApiOperation({
    summary: "Import participants from json or xlsx",
    description: "Send either a JSON body or an xlsx file",
  })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiOkResponse({ type: ParticipantsImportResultDto })
  @ApiBadRequestResponse({
    description:
      "Invalid body/file, unknown column header or more than 2000 participants",
  })
  @ApiNotFoundResponse({ description: "Event not found" })
  async importParticipants(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Req() request: Request,
    @Body() body: unknown,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<ParticipantsImportResultDto> {
    if (file != null) {
      return this.importExportService.importParticipantsFromXlsx(
        eventId,
        file.buffer,
      );
    }

    if (request.is("multipart/form-data") === "multipart/form-data") {
      throw new BadRequestException("Missing file: participantsFile");
    }

    const dto = await this.validateJsonBody(body);
    return this.importExportService.importParticipants(
      eventId,
      dto.participants,
    );
  }

  private async validateJsonBody(
    body: unknown,
  ): Promise<ParticipantsImportDto> {
    const pipe = new ValidationPipe({
      transform: true,
      forbidUnknownValues: true,
      whitelist: true,
    });

    return (await pipe.transform(body, {
      type: "body",
      metatype: ParticipantsImportDto,
    })) as ParticipantsImportDto;
  }
}
