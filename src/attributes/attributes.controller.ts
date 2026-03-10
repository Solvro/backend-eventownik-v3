import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { RequirePermission } from "src/auth/permissions.decorator";
import { PermissionsGuard } from "src/auth/permissions.guard";
import { PageDto } from "src/common/dto/page.dto";
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
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { AttributesService } from "./attributes.service";
import { AttributeListingDto } from "./dto/attribute-listing.dto";
import { CreateAttributeDto } from "./dto/create-attribute.dto";
import { UpdateAttributeDto } from "./dto/update-attribute.dto";
import { Attribute } from "./entities/attribute.entity";

@Controller("events/:eventId/attributes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission(PermissionType.MANAGE_EVENT)
@ApiTags("Attributes")
export class AttributesController {
  constructor(private attributesService: AttributesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new attribute" })
  @ApiResponse({
    status: 201,
    description: "The attribute has been successfully created.",
    type: Attribute,
  })
  @ApiResponse({ status: 404, description: "Event not found." })
  async create(
    @Body() createAttributeDto: CreateAttributeDto,
    @Param("eventId", ParseUUIDPipe) eventId: string,
  ) {
    return this.attributesService.create(createAttributeDto, eventId);
  }

  @Get()
  @ApiOperation({ summary: "Get a list of attributes for an event" })
  @ApiResponse({
    status: 200,
    description: "The list of attributes has been successfully retrieved.",
    type: PageDto<Attribute>,
  })
  @ApiResponse({ status: 404, description: "Event not found." })
  async findAll(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Query() query: AttributeListingDto,
  ) {
    return this.attributesService.findAll(eventId, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get an attribute by id" })
  @ApiResponse({
    status: 200,
    description: "The attribute has been successfully retrieved.",
    type: Attribute,
  })
  @ApiResponse({ status: 404, description: "Event or attribute not found." })
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
  ) {
    return this.attributesService.findOne(id, eventId);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update an attribute by id" })
  @ApiResponse({
    status: 200,
    description: "The attribute has been successfully updated.",
    type: Attribute,
  })
  @ApiResponse({ status: 404, description: "Event or attribute not found." })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body() updateAttributeDto: UpdateAttributeDto,
  ) {
    return this.attributesService.update(id, eventId, updateAttributeDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an attribute by id" })
  @ApiResponse({
    status: 204,
    description: "The attribute has been successfully deleted.",
  })
  @ApiResponse({ status: 404, description: "Event or attribute not found." })
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
  ) {
    return this.attributesService.remove(id, eventId);
  }
}
