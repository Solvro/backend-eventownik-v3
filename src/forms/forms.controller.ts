import { QueryListingDto } from "src/prisma/dto/query-listing.dto";

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { CreateFormDto } from "./dto/create-form.dto";
import { UpdateFormDto } from "./dto/update-form.dto";
import { FormsService } from "./forms.service";

@ApiTags("Forms")
@Controller("events/:eventId/forms")
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Creates a form for the specified event" })
  @ApiResponse({ status: 201, description: "Form created successfully." })
  @ApiResponse({ status: 404, description: "Event or Attribute not found." })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Given event has already a firstform assigned.",
  })
  async create(
    @Param("eventId") eventId: string,
    @Body() createFormDto: CreateFormDto,
  ) {
    return this.formsService.create(eventId, createFormDto);
  }
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get all forms for an event" })
  @ApiResponse({ status: 200, description: "Forms retrieved successfully." })
  @ApiResponse({ status: 404, description: "Event not found." })
  async findAll(
    @Param("eventId") eventId: string,
    @Query() query: QueryListingDto,
  ) {
    return this.formsService.findAll(eventId, query);
  }
  @Get(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get a form by id for an event" })
  @ApiResponse({ status: 200, description: "Form retrieved successfully." })
  @ApiResponse({ status: 404, description: "Event or Form not found." })
  async findOne(
    @Param("eventId") eventId: string,
    @Param("id") formId: string,
  ) {
    return this.formsService.findOne(formId, eventId);
  }
  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update a form for an event" })
  @ApiResponse({ status: 200, description: "Form updated successfully." })
  @ApiResponse({
    status: 404,
    description: "Event, Form or Attribute not found.",
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Given event has already a firstform assigned.",
  })
  async update(
    @Param("eventId") eventId: string,
    @Param("id") formId: string,
    @Body() updateFormDto: UpdateFormDto,
  ) {
    return this.formsService.update(formId, eventId, updateFormDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a form for an event" })
  @ApiResponse({ status: 204, description: "Form deleted successfully." })
  @ApiResponse({ status: 404, description: "Event or Form not found." })
  async remove(@Param("eventId") eventId: string, @Param("id") formId: string) {
    return this.formsService.remove(formId, eventId);
  }
}
