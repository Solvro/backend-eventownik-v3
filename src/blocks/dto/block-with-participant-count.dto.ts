import { ApiPropertyOptional } from "@nestjs/swagger";

import { Block } from "../entities/block.entity";

export class BlockWithParticipantCount extends Block {
  @ApiPropertyOptional()
  blockParticipantCount?: number;

  @ApiPropertyOptional({ isArray: true, type: () => BlockWithParticipantCount })
  declare children?: BlockWithParticipantCount[];
}
