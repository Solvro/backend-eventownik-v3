import { IsEnum, IsOptional, IsString } from "class-validator";
import { PageOptionsDto } from "src/common/dto/page-options.dto";
import { AttributeType } from "src/generated/prisma/client";

import { ApiPropertyOptional } from "@nestjs/swagger";

export class AttributeListingDto extends PageOptionsDto {
  @ApiPropertyOptional({ description: "Filter by attribute name" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: "Filter by attribute type",
    enum: AttributeType,
  })
  @IsOptional()
  @IsEnum(AttributeType)
  type?: AttributeType;
}
