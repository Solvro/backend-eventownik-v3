import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";
import { IsConfigValidForAttributeType } from "src/common/decorators/valid-config-for-attribute-type.decorator";
import { AttributeType } from "src/generated/prisma/client";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateAttributeDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsInt()
  order!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showInList?: boolean;

  @ApiProperty({
    description: "The type of the attribute",
    enum: AttributeType,
  })
  @IsEnum(AttributeType)
  type!: AttributeType;

  @ApiPropertyOptional({})
  @IsOptional()
  @IsObject()
  @IsConfigValidForAttributeType()
  config?: Record<string, unknown>;
}
