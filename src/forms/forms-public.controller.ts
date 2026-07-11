import { HcaptchaGuard } from "@gvrs/nestjs-hcaptcha";
import type { Request } from "express";

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
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBadRequestResponse,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import { FormSubmitionDto } from "./dto/form-submition.dto";
import { FormsService } from "./forms.service";

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
    @Req() request: Request,
  ) {
    await this.formsService.findOneBySlug(formId, eventSlug);
    const sourceIp = request.ip ?? request.socket.remoteAddress ?? "unknown";
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
  @ApiConsumes("application/json")
  @ApiOkResponse({ description: "Form submitted successfully." })
  @ApiNotFoundResponse({ description: "Event or Form not found." })
  @ApiBadRequestResponse({ description: "Form is closed or invalid." })
  async submit(
    @Param("eventSlug") eventSlug: string,
    @Param("id", ParseUUIDPipe) formId: string,
    @Body() submissionData: FormSubmitionDto,
  ) {
    return this.formsService.formSubmit(eventSlug, formId, submissionData);
  }
}
