import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from "class-validator";
import type { Prisma } from "src/generated/prisma/client";
import { EmailTrigger } from "src/generated/prisma/enums";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export const EMAIL_CONTENT_MAX_LENGTH = 14_000_000;

export class CreateEmailDto {
  @ApiProperty({ example: "Email template name" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: "<p>Content</p>" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(EMAIL_CONTENT_MAX_LENGTH, {
    message: "content must not exceed 10MB of embedded image data",
  })
  content: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  order?: number;

  @ApiProperty({ enum: EmailTrigger, example: EmailTrigger.MANUAL })
  @IsEnum(EmailTrigger)
  trigger: EmailTrigger;

  @ApiPropertyOptional({ type: Object, example: { formUuid: "uuid" } })
  @ValidateIf(
    (o: CreateEmailDto) =>
      o.trigger === EmailTrigger.FORM_FILLED ||
      o.trigger === EmailTrigger.ATTRIBUTE_CHANGED,
  )
  @IsObject()
  @IsNotEmpty()
  triggerConfig?: Prisma.JsonObject;

  @ApiPropertyOptional({ type: Object, example: { version: "1.0" } })
  @IsOptional()
  @IsObject()
  schema?: Prisma.JsonObject;
}
