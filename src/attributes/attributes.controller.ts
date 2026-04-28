import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { RequirePermission } from "src/auth/permissions.decorator";
import { PermissionsGuard } from "src/auth/permissions.guard";
import { ApiPaginatedResponse } from "src/common/decorators/api-paginated-response.decorator";
import { PermissionType } from "src/generated/prisma/enums";

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseArrayPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
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

import { AttributesService } from "./attributes.service";
import { AttributeListingDto } from "./dto/attribute-listing.dto";
import { BulkUpdateAttributeDto } from "./dto/bulk-update-attribute.dto";
import { CreateAttributeDto } from "./dto/create-attribute.dto";
import { UpdateAttributeDto } from "./dto/update-attribute.dto";
import { Attribute } from "./entities/attribute.entity";

@Controller("events/:eventId/attributes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission(PermissionType.MANAGE_EVENT)
@ApiUnauthorizedResponse({ description: "Unauthorized" })
@ApiForbiddenResponse({ description: "Forbidden - insufficient permissions" })
@ApiTags("Attributes")
export class AttributesController {
  constructor(private attributesService: AttributesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new attribute" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiCreatedResponse({
    description: "The attribute has been successfully created.",
    type: Attribute,
  })
  @ApiNotFoundResponse({ description: "Event not found." })
  async create(
    @Body() createAttributeDto: CreateAttributeDto,
    @Param("eventId", ParseUUIDPipe) eventId: string,
  ) {
    return this.attributesService.create(createAttributeDto, eventId);
  }

  @Patch("bulk")
  @ApiOperation({
    summary: "Create/update many attributes (single transaction)",
  })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiOkResponse({
    description: "Attributes successfully processed.",
    type: Attribute,
    isArray: true,
  })
  @ApiNotFoundResponse({ description: "Event or attribute not found." })
  async bulkUpdate(
    @Body(new ParseArrayPipe({ items: BulkUpdateAttributeDto }))
    attributes: BulkUpdateAttributeDto[],
    @Param("eventId", ParseUUIDPipe) eventId: string,
  ) {
    return this.attributesService.bulkUpdate(eventId, attributes);
  }

  @Get()
  @ApiOperation({ summary: "Get a list of attributes for an event" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiPaginatedResponse(Attribute)
  @ApiNotFoundResponse({ description: "Event not found." })
  async findAll(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Query() query: AttributeListingDto,
  ) {
    return this.attributesService.findAll(eventId, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get an attribute by id" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "id", description: "UUID of the attribute" })
  @ApiOkResponse({
    description: "The attribute has been successfully retrieved.",
    type: Attribute,
  })
  @ApiNotFoundResponse({ description: "Event or attribute not found." })
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
  ) {
    return this.attributesService.findOne(id, eventId);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update an attribute by id" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "id", description: "UUID of the attribute" })
  @ApiOkResponse({
    description: "The attribute has been successfully updated.",
    type: Attribute,
  })
  @ApiNotFoundResponse({ description: "Event or attribute not found." })
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
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "id", description: "UUID of the attribute" })
  @ApiNoContentResponse({
    description: "The attribute has been successfully deleted.",
  })
  @ApiNotFoundResponse({ description: "Event or attribute not found." })
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
  ) {
    return this.attributesService.remove(id, eventId);
  }
}
