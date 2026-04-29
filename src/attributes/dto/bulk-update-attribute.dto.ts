import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from "class-validator";
import { IsConfigValidForAttributeType } from "src/common/decorators/valid-config-for-attribute-type.decorator";
import { AttributeType } from "src/generated/prisma/client";

import { ApiPropertyOptional } from "@nestjs/swagger";

export class BulkUpdateAttributeDto {
  @ApiPropertyOptional({
    description:
      "If provided, updates an existing attribute; otherwise creates.",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsOptional()
  @IsUUID()
  uuid?: string;

  @ApiPropertyOptional()
  @ValidateIf((attribute) => attribute.uuid == null)
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @ValidateIf((attribute) => attribute.uuid == null)
  @IsInt()
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showInList?: boolean;

  @ApiPropertyOptional({
    description: "The type of the attribute",
    enum: AttributeType,
  })
  @ValidateIf((attribute) => attribute.uuid == null)
  @IsEnum(AttributeType)
  type?: AttributeType;

  @ApiPropertyOptional({})
  @IsOptional()
  @IsObject()
  @IsConfigValidForAttributeType()
  config?: Record<string, unknown>;
}
