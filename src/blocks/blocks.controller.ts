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
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { BlocksService } from "./blocks.service";
import { BlockListingDto } from "./dto/block-listing.dto";
import { CreateBlockDto } from "./dto/create-block.dto";
import { UpdateBlockDto } from "./dto/update-block.dto";
import { Block } from "./entities/block.entity";

@ApiTags("Blocks")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission(PermissionType.MANAGE_EVENT)
@ApiBearerAuth()
@Controller("events/:eventId/attributes/:attributeId/blocks")
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Post()
  @ApiOperation({ summary: "Create a block" })
  @ApiCreatedResponse({ description: "The created block", type: Block })
  async create(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("attributeId", ParseUUIDPipe) attributeId: string,
    @Body() createBlockDto: CreateBlockDto,
  ) {
    return this.blocksService.create(eventId, attributeId, createBlockDto);
  }

  @Get()
  @ApiOperation({ summary: "Get list of blocks with pagination and filtering" })
  @ApiOkResponse({ description: "List of blocks", type: PageDto<Block> })
  async findAll(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("attributeId", ParseUUIDPipe) attributeId: string,
    @Query() query: BlockListingDto,
  ): Promise<PageDto<Block>> {
    return this.blocksService.findAll(eventId, attributeId, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get block by ID" })
  @ApiOkResponse({ description: "The block", type: Block })
  async findOne(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("attributeId", ParseUUIDPipe) attributeId: string,
    @Param("id", ParseUUIDPipe) blockId: string,
  ) {
    return this.blocksService.findOne(eventId, attributeId, blockId);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update block" })
  @ApiOkResponse({ description: "The updated block", type: Block })
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
  @ApiNoContentResponse({ description: "Block successfully deleted" })
  async remove(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("attributeId", ParseUUIDPipe) attributeId: string,
    @Param("id", ParseUUIDPipe) blockId: string,
  ) {
    return this.blocksService.remove(eventId, attributeId, blockId);
  }
}
