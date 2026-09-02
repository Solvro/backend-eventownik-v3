import { Type } from "class-transformer";
import { IsDate, IsOptional, IsString } from "class-validator";
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

  @Type(() => Date)
  @IsDate()
  @ApiPropertyOptional({
    description: "Events that are happening before this date",
  })
  @IsOptional()
  readonly before?: Date;

  @Type(() => Date)
  @IsDate()
  @ApiPropertyOptional({
    description: "Events that are happening after this date",
  })
  @IsOptional()
  readonly after?: Date;
}
