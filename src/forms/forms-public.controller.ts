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
import { FormsService } from "./forms.service";
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { UploadFiles } from "./utils/upload-files-decorator";
import { FormSubmitionDto } from "./dto/form-submition.dto";

@ApiTags("Public")
@ApiTags("FormsPublic")
@ApiTags("Forms")
@Controller("/public/events/:eventSlug/forms")
export class FormsPublicController {
  constructor(private readonly formsService: FormsService) {}

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get a form by id for an event" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
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
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "id", description: "UUID of the form" })
  @ApiOkResponse({ description: "Form submitted successfully." })
  @ApiNotFoundResponse({ description: "Event or Form not found." })
  @ApiBadRequestResponse({ description: "Form is closed." })
  @UploadFiles()
  async submit(
    @Param("eventSlug", ParseUUIDPipe) eventId: string,
    @Param("id", ParseUUIDPipe) formId: string,
    @UploadedFiles()
    files: Express.Multer.File[] | null,
    @Body() submissionData: FormSubmitionDto,
  ) {
    const filenames: string[] =
      files == null ? [] : files.map((file) => file.filename);
    return this.formsService.formSubmit(
      eventId,
      formId,
      submissionData,
      filenames,
    );
  }
}
