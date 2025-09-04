import { Type } from "class-transformer";
import {
  IsDate,
  IsEmail,
  IsHexColor,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  MinLength,
  registerDecorator,
} from "class-validator";

export class CreateEventDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsOptional()
  @IsString({ each: true })
  links?: string[];

  @IsOptional()
  @IsString({ each: true })
  policyLinks?: string[];

  @Type(() => Date)
  @IsDate()
  @IsFutureDate()
  startDate: Date;

  @Type(() => Date)
  @IsDate()
  @IsFutureDate()
  endDate: Date;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  participantsLimit?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  verifiedAt?: Date;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  organizerName?: string;

  @IsOptional()
  @IsUrl()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  slug?: string;
}

function IsFutureDate() {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      constraints: [],
      validator: {
        validate(value: Date) {
          return value instanceof Date && value > new Date();
        },
        defaultMessage() {
          return `${propertyName} must be in the future`;
        },
      },
    });
  };
}
