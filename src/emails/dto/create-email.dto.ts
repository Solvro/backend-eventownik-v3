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

export class CreateEmailDto {
  @IsString()
  @IsNotEmpty()
  name: string;
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsNumber()
  @IsOptional()
  order?: number;

  @IsEnum(EmailTrigger)
  trigger: EmailTrigger;

  @ValidateIf(
    (o: CreateEmailDto) =>
      o.trigger === EmailTrigger.FORM_FILLED ||
      o.trigger === EmailTrigger.ATTRIBUTE_CHANGED ||
      o.triggerValue !== undefined,
  )
  @IsNotEmpty()
  @IsString()
  triggerValue?: string;

  @ValidateIf(
    (o: CreateEmailDto) =>
      o.trigger === EmailTrigger.FORM_FILLED ||
      o.trigger === EmailTrigger.ATTRIBUTE_CHANGED ||
      o.triggerValue2 !== undefined,
  )
  @IsNotEmpty()
  @IsString()
  triggerValue2?: string;

  @IsUUID("4", { each: true })
  @IsOptional()
  formId?: string;
}
