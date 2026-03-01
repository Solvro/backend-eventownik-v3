import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { PageOptionsDto } from "src/common/dto/page-options.dto";

import { ApiPropertyOptional } from "@nestjs/swagger";

export class FormListingDto extends PageOptionsDto {
  @ApiPropertyOptional({ description: "Filter by form name" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: "Filter by editability status" })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === "true")
  isEditable?: boolean;
}
