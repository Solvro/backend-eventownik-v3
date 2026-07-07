import { StorageService } from "src/storage/storage.service";

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFiles,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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
import { FormsService } from "./forms.service";
import { UploadFiles } from "./utils/upload-files-decorator";

@ApiTags("Public")
@ApiTags("FormsPublic")
@ApiTags("Forms")
@Controller("/public/events/:eventSlug/forms")
export class FormsPublicController {
  constructor(
    private readonly formsService: FormsService,
    private readonly storageService: StorageService,
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

  @Post(":id/submit")
  @HttpCode(HttpStatus.OK)
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
            "- for files write filename with extension (e.g., 'document.pdf')",
          items: {
            $ref: getSchemaPath(ParticipantAttributeDto),
          },
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
    const fileUrlMap: Record<string, string | undefined> = {};
    if (files != null && files.length > 0) {
      const bucket = this.configService.getOrThrow<string>("S3_BUCKET_FORMS");
      await Promise.all(
        files.map(async (file) => {
          fileUrlMap[file.originalname] = await this.storageService.upload(
            bucket,
            file,
          );
        }),
      );
    }
    return this.formsService.formSubmit(
      eventSlug,
      formId,
      submissionData,
      fileUrlMap,
    );
  }
}
