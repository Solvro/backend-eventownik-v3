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
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { CreateFormDto } from "./dto/create-form.dto";
import { DuplicateFormDto } from "./dto/duplicate-form.dto";
import { FormListingDto } from "./dto/form-listing.dto";
import { UpdateFormDto } from "./dto/update-form.dto";
import { FormsService } from "./forms.service";

@ApiTags("Forms")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission(PermissionType.MANAGE_FORM)
@ApiUnauthorizedResponse({ description: "Unauthorized" })
@ApiForbiddenResponse({ description: "Forbidden - insufficient permissions" })
@Controller("events/:eventId/forms")
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Creates a form for the specified event" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiCreatedResponse({ description: "Form created successfully." })
  @ApiNotFoundResponse({ description: "Event or Attribute not found." })
  @ApiBadRequestResponse({
    description: "Given event has already a firstform assigned.",
  })
  async create(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body() createFormDto: CreateFormDto,
  ) {
    return this.formsService.create(eventId, createFormDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get all forms for an event" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiOkResponse({ description: "Forms retrieved successfully." })
  @ApiNotFoundResponse({ description: "Event not found." })
  async findAll(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Query() query: FormListingDto,
  ) {
    return this.formsService.findAll(eventId, query);
  }

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get a form by id for an event" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "id", description: "UUID of the form" })
  @ApiOkResponse({ description: "Form retrieved successfully." })
  @ApiNotFoundResponse({ description: "Event or Form not found." })
  async findOne(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("id", ParseUUIDPipe) formId: string,
  ) {
    return this.formsService.findOne(formId, eventId);
  }

  @Post(":id/duplicate")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Duplicate a form (including its definition) for an event",
  })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "id", description: "UUID of the form to duplicate" })
  @ApiCreatedResponse({ description: "Form duplicated successfully." })
  @ApiNotFoundResponse({ description: "Event or Form not found." })
  async duplicate(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("id", ParseUUIDPipe) formId: string,
    @Body() duplicateFormDto: DuplicateFormDto,
  ) {
    return this.formsService.duplicate(formId, eventId, duplicateFormDto);
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update a form for an event" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "id", description: "UUID of the form" })
  @ApiOkResponse({ description: "Form updated successfully." })
  @ApiNotFoundResponse({ description: "Event, Form or Attribute not found." })
  @ApiBadRequestResponse({
    description: "Given event has already a firstform assigned.",
  })
  async update(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("id", ParseUUIDPipe) formId: string,
    @Body() updateFormDto: UpdateFormDto,
  ) {
    return this.formsService.update(formId, eventId, updateFormDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a form for an event" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "id", description: "UUID of the form" })
  @ApiNoContentResponse({ description: "Form deleted successfully." })
  @ApiNotFoundResponse({ description: "Event or Form not found." })
  async remove(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("id", ParseUUIDPipe) formId: string,
  ) {
    return this.formsService.remove(formId, eventId);
  }
}
