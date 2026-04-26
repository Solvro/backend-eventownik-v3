import { Type } from "class-transformer";
import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ParticipantAttributeDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  attributeUuid: string;

  @ApiPropertyOptional({
    description:
      "Value for the participant attribute:\n - For files: provide the file name\n - For multiselect: write options separated by ;",
  })
  @IsOptional()
  @IsString()
  value?: string;
}

export class FormSubmitionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  participantId?: string;

  @ApiProperty({
    isArray: true,
    description: "Array of participant attributes with their values",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipantAttributeDto)
  attributes: ParticipantAttributeDto[];
}
