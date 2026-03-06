import { IsOptional, IsString } from "class-validator";
import { PageOptionsDto } from "src/common/dto/page-options.dto";

import { ApiPropertyOptional } from "@nestjs/swagger";

export class BlockListingDto extends PageOptionsDto {
  @ApiPropertyOptional({ description: "Filter by name" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: "Filter by parentUuid" })
  @IsOptional()
  @IsString()
  parentUuid?: string;
}
