import { HcaptchaGuard } from "@gvrs/nestjs-hcaptcha";

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  getSchemaPath,
} from "@nestjs/swagger";

import {
  FormSubmitionDto,
  ParticipantAttributeDto,
} from "./dto/form-submition.dto";
import { FileUploadResponseDto } from "./dto/upload-file.dto";
import { FormsService } from "./forms.service";
import { UploadFiles } from "./utils/upload-files-decorator";

@ApiTags("Public")
@ApiTags("FormsPublic")
@ApiTags("Forms")
@Controller("/public/events/:eventSlug/forms")
export class FormsPublicController {
  constructor(
    private readonly formsService: FormsService,
    private readonly configService: ConfigService,
  ) {}

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get a form by id for an event" })
  @ApiParam({ name: "eventSlug", description: "Event slug of the event" })
  @ApiParam({ name: "id", description: "UUID of the form" })
  @ApiOkResponse({ description: "Form retrieved successfully." })
  @ApiNotFoundResponse({ description: "Event or Form not found." })
  async findOne(
    @Param("eventSlug") eventSlug: string,
    @Param("id", ParseUUIDPipe) formId: string,
  ) {
    return this.formsService.findOneBySlug(formId, eventSlug);
  }

  @Post(":id/files")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Upload a single file for a form" })
  @ApiParam({ name: "eventSlug", description: "Event slug of the event" })
  @ApiParam({ name: "id", description: "UUID of the form" })
  @UseInterceptors(FileInterceptor("file"))
  async uploadFile(
    @Param("eventSlug") eventSlug: string,
    @Param("id", ParseUUIDPipe) formId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    await this.formsService.findOneBySlug(formId, eventSlug);
    const sourceIp = req.ip || req.socket.remoteAddress || "unknown";
    return this.formsService.uploadSingleFile(
      file,
      formId,
      sourceIp,
      this.configService,
    );
  }

  @Post(":id/submit")
  @HttpCode(HttpStatus.OK)
  @UseGuards(HcaptchaGuard)
  @ApiOperation({ summary: "Submit a form for an event" })
  @ApiParam({ name: "eventSlug", description: "Event slug of the event" })
  @ApiParam({ name: "id", description: "UUID of the form" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        email: {
          type: "string",
          format: "email",
          nullable: true,
          description: "Participant's email",
          example: "user@example.com",
        },
        participantId: {
          type: "string",
          format: "uuid",
          nullable: true,
          description: "UUID of the participant",
          example: "123e4567-e89b-12d3-a456-426614174000",
        },
        attributes: {
          type: "array",
          description:
            "Array of participant attributes with their values. \n" +
            "For each attribute, the value must match the attribute type:\n" +
            "- text/select: string\n" +
            "- number: number\n" +
            "- multiSelect/block: string[] (Array of UUIDs or options)\n" +
            "- checkbox: boolean\n" +
            "- file: ignored (use fileAttributeMap to link files)",
          items: {
            $ref: getSchemaPath(ParticipantAttributeDto),
          },
        },
        fileAttributeMap: {
          type: "object",
          description:
            "Maps file attribute UUIDs to their index in the files array. Example: {'attr-uuid-1': 0, 'attr-uuid-2': 1}",
          example: { "attr-uuid-123": 0 },
        },
        files: {
          type: "array",
          description: "Optional files to attach to the submission",
          items: {
            type: "string",
            format: "binary",
          },
        },
      },
    },
  })
  @ApiOkResponse({ description: "Form submitted successfully." })
  @ApiNotFoundResponse({ description: "Event or Form not found." })
  @ApiBadRequestResponse({ description: "Form is closed." })
  @UploadFiles()
  async submit(
    @Param("eventSlug") eventSlug: string,
    @Param("id", ParseUUIDPipe) formId: string,
    @UploadedFiles()
    files: Express.Multer.File[] | null,
    @Body() submissionData: FormSubmitionDto,
  ) {
    const fileKeyMapByAttributeUuid = await this.formsService.handleFileUploads(
      files,
      submissionData.fileAttributeMap,
    );
    return this.formsService.formSubmit(
      eventSlug,
      formId,
      submissionData,
      fileKeyMapByAttributeUuid,
    );
  }
}
