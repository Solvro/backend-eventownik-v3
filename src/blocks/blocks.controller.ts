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
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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

import { BlocksService } from "./blocks.service";
import { CreateBlockDto } from "./dto/create-block.dto";
import { DuplicateBlockDto } from "./dto/duplicate-block.dto";
import { UpdateBlockDto } from "./dto/update-block.dto";
import { Block } from "./entities/block.entity";

@ApiTags("Blocks")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission(PermissionType.MANAGE_EVENT)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "Unauthorized" })
@ApiForbiddenResponse({ description: "Forbidden - insufficient permissions" })
@Controller("events/:eventId/attributes/:attributeId/blocks")
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Post()
  @ApiOperation({ summary: "Create a block" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "attributeId", description: "UUID of the attribute" })
  @ApiCreatedResponse({ description: "The created block", type: Block })
  async create(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("attributeId", ParseUUIDPipe) attributeId: string,
    @Body() createBlockDto: CreateBlockDto,
  ) {
    return this.blocksService.create(eventId, attributeId, createBlockDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all blocks for the attribute" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "attributeId", description: "UUID of the attribute" })
  @ApiOkResponse({
    description: "Tree of blocks starting from the root",
    type: Block,
  })
  async findAll(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("attributeId", ParseUUIDPipe) attributeId: string,
  ) {
    return this.blocksService.findAll(eventId, attributeId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get block by ID" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "attributeId", description: "UUID of the attribute" })
  @ApiParam({ name: "id", description: "UUID of the block" })
  @ApiOkResponse({ description: "The block", type: Block })
  @ApiNotFoundResponse({ description: "Block not found" })
  async findOne(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("attributeId", ParseUUIDPipe) attributeId: string,
    @Param("id", ParseUUIDPipe) blockId: string,
  ) {
    return this.blocksService.findOne(eventId, attributeId, blockId);
  }

  @Post(":id/duplicate")
  @ApiOperation({
    summary: "Duplicate a block (basic attributes only, without children)",
  })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "attributeId", description: "UUID of the attribute" })
  @ApiParam({ name: "id", description: "UUID of the block to duplicate" })
  @ApiCreatedResponse({ description: "The duplicated block", type: Block })
  @ApiBadRequestResponse({ description: "Root block cannot be duplicated" })
  @ApiNotFoundResponse({ description: "Block not found" })
  async duplicate(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("attributeId", ParseUUIDPipe) attributeId: string,
    @Param("id", ParseUUIDPipe) blockId: string,
    @Body() duplicateBlockDto: DuplicateBlockDto,
  ) {
    return this.blocksService.duplicate(
      eventId,
      attributeId,
      blockId,
      duplicateBlockDto,
    );
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update block" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "attributeId", description: "UUID of the attribute" })
  @ApiParam({ name: "id", description: "UUID of the block" })
  @ApiOkResponse({ description: "The updated block", type: Block })
  @ApiNotFoundResponse({ description: "Block not found" })
  async update(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("attributeId", ParseUUIDPipe) attributeId: string,
    @Param("id", ParseUUIDPipe) blockId: string,
    @Body() updateBlockDto: UpdateBlockDto,
  ) {
    return this.blocksService.update(
      eventId,
      attributeId,
      blockId,
      updateBlockDto,
    );
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete block" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "attributeId", description: "UUID of the attribute" })
  @ApiParam({ name: "id", description: "UUID of the block" })
  @ApiNoContentResponse({ description: "Block successfully deleted" })
  @ApiNotFoundResponse({ description: "Block not found" })
  async remove(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("attributeId", ParseUUIDPipe) attributeId: string,
    @Param("id", ParseUUIDPipe) blockId: string,
  ) {
    return this.blocksService.remove(eventId, attributeId, blockId);
  }
}
