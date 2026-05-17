import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
} from "class-validator";
import type { Prisma } from "src/generated/prisma/client";
import { EmailTrigger } from "src/generated/prisma/enums";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateEmailDto {
  @ApiProperty({ example: "Email template name" })
  @IsString()
  @IsNotEmpty()
  name: string;
  @ApiProperty({ example: "<p>Content</p>" })
  @IsString()
  @IsNotEmpty()
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
}
