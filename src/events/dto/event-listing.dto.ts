import { IsOptional, IsString } from "class-validator";
import { PageOptionsDto } from "src/common/dto/page-options.dto";

import { ApiPropertyOptional } from "@nestjs/swagger";

export class EventListingDto extends PageOptionsDto {
  @ApiPropertyOptional({ description: "Filter by event name" })
  @IsOptional()
  @IsString()
  readonly name?: string;

  @ApiPropertyOptional({ description: "Filter by event location" })
  @IsOptional()
  @IsString()
  readonly location?: string;

  // TODO: add moer filtering options
}
