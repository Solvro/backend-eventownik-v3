import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from "class-validator";
import { AttributeType } from "src/generated/prisma/client";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateAttributeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ isArray: true, type: String })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiProperty()
  @IsInt()
  order: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showInList?: boolean;

  @ApiProperty({
    description: "The type of the attribute",
    enum: AttributeType,
  })
  @IsEnum(AttributeType)
  type: AttributeType;
}
