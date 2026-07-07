import { Transform, Type, plainToInstance } from "class-transformer";
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
      "The value must match the attribute type:\n" +
      "- text/select: string\n" +
      "- number: number\n" +
      "- multiSelect/block: string[] (Array of UUIDs or options)\n" +
      "- checkbox: boolean\n" +
      "- for files write filename with extension (e.g., 'document.pdf')",
  })
  @IsOptional()
  value?: unknown;
}

export class FormSubmitionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsEmail()
  @Transform(({ value }) => (value === "" ? undefined : (value as string)))
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  @Transform(({ value }) => (value === "" ? undefined : (value as string)))
  participantId?: string;

  @ApiProperty({
    isArray: true,
    description: "Array of participant attributes with their values",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipantAttributeDto)
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === "") {
      return [];
    }
    if (typeof value === "string") {
      try {
        const parsed: unknown = JSON.parse(value);
        const array = Array.isArray(parsed) ? parsed : [parsed];
        return plainToInstance(ParticipantAttributeDto, array);
      } catch {
        return value as unknown;
      }
    }

    return value as unknown;
  })
  attributes: ParticipantAttributeDto[];

  // @ApiProperty({
  //   description: "hCaptcha response token",
  // })
  // @IsString()
  // @IsNotEmpty()
  // "h-captcha-response": string;
}
