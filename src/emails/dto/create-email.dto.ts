import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from "class-validator";
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

  @ApiPropertyOptional()
  @ValidateIf(
    (o: CreateEmailDto) =>
      o.trigger === EmailTrigger.FORM_FILLED ||
      o.trigger === EmailTrigger.ATTRIBUTE_CHANGED ||
      o.triggerValue !== undefined,
  )
  @IsNotEmpty()
  @IsString()
  triggerValue?: string;

  @ApiPropertyOptional()
  @ValidateIf(
    (o: CreateEmailDto) =>
      o.trigger === EmailTrigger.FORM_FILLED ||
      o.trigger === EmailTrigger.ATTRIBUTE_CHANGED ||
      o.triggerValue2 !== undefined,
  )
  @IsNotEmpty()
  @IsString()
  triggerValue2?: string;
}
