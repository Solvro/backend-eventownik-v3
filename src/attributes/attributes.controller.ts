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
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { AttributesService } from "./attributes.service";
import { CreateAttributeDto } from "./dto/create-attribute.dto";
import { UpdateAttributeDto } from "./dto/update-attribute.dto";

@Controller("events/:eventId/attributes")
@ApiTags("Attributes")
export class AttributesController {
  constructor(private attributesService: AttributesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new attribute" })
  @ApiResponse({
    status: 201,
    description: "The attribute has been successfully created.",
  })
  @ApiResponse({ status: 404, description: "Event not found." })
  async create(
    @Body() createAttributeDto: CreateAttributeDto,
    @Param("eventId", ParseUUIDPipe) eventId: string,
  ) {
    return this.attributesService.create(createAttributeDto, eventId);
  }

  // @Get()
  // findAll() {
  //   return this.attributesService.findAll();
  // }

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get an attribute by id" })
  @ApiResponse({
    status: 200,
    description: "The attribute has been successfully retrieved.",
  })
  @ApiResponse({ status: 404, description: "Event or attribute not found." })
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
  ) {
    return this.attributesService.findOne(id, eventId);
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update an attribute by id" })
  @ApiResponse({
    status: 200,
    description: "The attribute has been successfully updated.",
  })
  @ApiResponse({ status: 404, description: "Event or attribute not found." })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body() updateAttributeDto: UpdateAttributeDto,
  ) {
    return this.attributesService.update(id, eventId, updateAttributeDto);
  }

  // @Delete(":id")
  // remove(@Param("id") id: string) {
  //   return this.attributesService.remove(+id);
  // }
}
