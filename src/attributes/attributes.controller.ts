import { Attribute } from "@prisma/client";

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { QueryListingDto } from "../prisma/dto/query-listing.dto";
import { AttributesService } from "./attributes.service";
import { CreateAttributeDto } from "./dto/create-attribute.dto";
import { UpdateAttributeDto } from "./dto/update-attribute.dto";

@Controller("api/v1")
@ApiTags("Attributes")
export class AttributesController {
  constructor(private attributesService: AttributesService) {}

  @Get("internal/attributes")
  @ApiOperation({ summary: "Attributes Endpoint" })
  @ApiResponse({ status: 200, description: "List of attributes" })
  async index(@Query() query: QueryListingDto): Promise<Attribute[]> {
    return await this.attributesService.findAll(query);
  }

  @Get("internal/attributes/:uuid")
  @ApiOperation({ summary: "Show Attribute Endpoint" })
  @ApiResponse({ status: 200, description: "Show Attribute with provided ID" })
  async show(@Param("uuid") uuid: string): Promise<Attribute> {
    return await this.attributesService.findOne(uuid);
  }

  @Post("internal/attributes")
  @ApiOperation({ summary: "Create Attribute Endpoint" })
  @ApiResponse({ status: 201, description: "Returns created attribute" })
  async create(@Body() createAttributeDto: CreateAttributeDto) {
    return await this.attributesService.create(createAttributeDto);
  }

  @Put("internal/attributes/:uuid")
  @ApiOperation({ summary: "Update Attribute Endpoint" })
  @ApiResponse({ status: 200, description: "Returns updated attribute" })
  async update(
    @Param("uuid") uuid: string,
    @Body() updateAttributeDto: UpdateAttributeDto,
  ) {
    return await this.attributesService.update(uuid, updateAttributeDto);
  }

  @Delete("internal/attributes/:uuid")
  @ApiOperation({ summary: "Delete Attribute Endpoint" })
  @ApiResponse({ status: 204, description: "No content" })
  async remove(@Param("uuid") uuid: string) {
    return await this.attributesService.remove(uuid);
  }
}
