import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateIf,
} from "class-validator";
import { AttributeType } from "src/generated/prisma/client";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateAttributeDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ isArray: true, type: String })
  @ValidateIf((o: CreateAttributeDto) =>
    ["select", "multiSelect"].includes(o.type),
  )
  @IsArray()
  @ArrayMinSize(1)
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
