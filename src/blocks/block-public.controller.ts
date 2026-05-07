import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import {
  ApiCreatedResponse,
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
  @ApiCreatedResponse({ description: "Block tree", type: Block })
  async getBlockTree(
    @Param("eventSlug") eventSlug: string,
    @Param("attributeUuid", ParseUUIDPipe) attributeUuid: string,
  ): Promise<Block> {
    return await this.blocksService.getBlockTree(eventSlug, attributeUuid);
  }
}
