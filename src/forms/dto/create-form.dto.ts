import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { CreateFormDefinicionDto } from "./create-form-definicion.dto";

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
  @ApiPropertyOptional()
  @IsOptional()
  isFirstForm?: boolean;

  @ApiProperty({ isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFormDefinicionDto)
  attributes: CreateFormDefinicionDto[];
}
