import { Type } from "class-transformer";
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
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
      "The value must match the attribute type:\n" +
      "- text/select: string\n" +
      "- number: number\n" +
      "- multiSelect/block: string[] (Array of UUIDs or options)\n" +
      "- checkbox: boolean",
  })
  @IsOptional()
  value?: unknown;
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

  @ApiProperty({
    description: "hCaptcha response token",
  })
  @IsString()
  @IsNotEmpty()
  "h-captcha-response": string;
}
