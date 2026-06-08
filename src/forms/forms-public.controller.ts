import { VerifyCaptcha } from "@gvrs/nestjs-hcaptcha";

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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import { StorageService } from "src/storage/storage.service";

import { FormSubmitionDto } from "./dto/form-submition.dto";
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
    const fileUrlMap: Record<string, string> = {};
    if (files?.length) {
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
