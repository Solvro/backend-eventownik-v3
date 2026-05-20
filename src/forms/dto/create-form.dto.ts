import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { OpenCondition } from "src/generated/prisma/client";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { CreateFormDefinitionDto } from "./create-form-definition.dto";

export class CreateFormDto {
  @IsString()
  @ApiProperty()
  name: string;

  @IsBoolean()
  @ApiPropertyOptional()
  @IsOptional()
  isEditable?: boolean;

  @Type(() => Date)
  @IsDate()
  @ApiPropertyOptional()
  @IsOptional()
  openDate?: Date;

  @Type(() => Date)
  @IsDate()
  @ApiPropertyOptional()
  @IsOptional()
  closeDate?: Date;

  @IsString()
  @ApiPropertyOptional()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @ApiPropertyOptional({
    description:
      "Indicates if this form is the first form (registration form) for the event",
  })
  @IsOptional()
  isFirstForm?: boolean;

  @ApiProperty({ type: CreateFormDefinitionDto, isArray: true })
  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => CreateFormDefinitionDto)
  attributes: CreateFormDefinitionDto[];

  @ApiPropertyOptional({
    enum: OpenCondition,
    description:
      "Indicates the condition for closing the form. If not provided, it defaults to 'MANUAL'.",
  })
  @IsOptional()
  @IsEnum(OpenCondition)
  openCondition?: OpenCondition;

  @ApiPropertyOptional({
    description:
      "Indicates if the form is open or closed when openCondition is set to MANUAL.",
  })
  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;
}
