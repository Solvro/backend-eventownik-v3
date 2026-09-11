import { Transform, Type, plainToInstance } from "class-transformer";
import {
  IsArray,
  IsBoolean,
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
      "- file: fileToken (UUID returned from upload endpoint)\n" +
      "- drawing: fileToken (UUID returned from upload endpoint; image uploads only)",
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

  @ApiPropertyOptional({
    description:
      "Guard confirming the frontend's GDPR consent checkbox was checked. " +
      "Registration itself constitutes consent; this only prevents bypassing the frontend checkbox by calling the API directly. " +
      "Required (must be true) when submitting the registration form; ignored otherwise.",
  })
  @IsOptional()
  @IsBoolean()
  gdprConsent?: boolean;

  @ApiPropertyOptional({
    description:
      "Guard confirming the frontend's terms-of-participation checkbox was checked. " +
      "Required (must be true) when submitting the registration form and the event has a " +
      "policy (terms) link attached; ignored otherwise.",
  })
  @IsOptional()
  @IsBoolean()
  termsAccepted?: boolean;

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
