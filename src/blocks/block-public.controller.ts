import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import { BlocksService } from "./blocks.service";
import { Block } from "./entities/block.entity";

@ApiTags("Public")
@Controller("public/events/:eventSlug/attributes/:attributeUuid/blocks")
export class BlocksPublicController {
  constructor(private readonly blocksService: BlocksService) {}

  @Get("")
  @ApiOperation({ summary: "Get block tree" })
  @ApiParam({ name: "eventSlug", description: "Slug of the event" })
  @ApiParam({ name: "attributeUuid", description: "UUID of the attribute" })
  @ApiOkResponse({ description: "Block tree", type: Block })
  @ApiNotFoundResponse({ description: "Block not found" })
  async getBlockTree(
    @Param("eventSlug") eventSlug: string,
    @Param("attributeUuid", ParseUUIDPipe) attributeUuid: string,
  ): Promise<Block> {
    return await this.blocksService.getBlockTree(eventSlug, attributeUuid);
  }

  @Get(":blockUuid")
  @ApiOperation({ summary: "Get a list of block participants" })
  @ApiParam({ name: "eventSlug", description: "Slug of the event" })
  @ApiParam({ name: "attributeUuid", description: "UUID of the attribute" })
  @ApiParam({ name: "blockUuid", description: "UUID of the block" })
  @ApiOkResponse({ description: "A list of block participants", type: Block })
  @ApiNotFoundResponse({ description: "Block not found" })
  async getBlockParticipants(
    @Param("eventSlug") eventSlug: string,
    @Param("attributeUuid", ParseUUIDPipe) attributeUuid: string,
    @Param("blockUuid", ParseUUIDPipe) blockUuid: string,
  ) {
    return await this.blocksService.getBlockParticipants(
      eventSlug,
      attributeUuid,
      blockUuid,
    );
  }
}
