import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

import { PartialType } from "@nestjs/swagger";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
/** Trims and turns "" into null, so optional text can be cleared. */
const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

export class MobileAppConfigDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  welcomeMessage?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @Matches(/^#[0-9a-f]{6}$/i, {
    message: "accentColor must be a hex colour like #F9D574",
  })
  accentColor?: string | null;

  @IsOptional()
  @IsBoolean()
  sosEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  scheduleEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  chatEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  tinderEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  bingoEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  berealEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(5)
  bingoSize?: number;
}

export class CreateMobileSosContactDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  phone: string;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsInt()
  order?: number;
}

export class UpdateMobileSosContactDto extends PartialType(
  CreateMobileSosContactDto,
) {}

export class CreateMobileFaqItemDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  question: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  answer: string;

  @IsOptional()
  @IsInt()
  order?: number;
}

export class UpdateMobileFaqItemDto extends PartialType(
  CreateMobileFaqItemDto,
) {}

export class CreateMobileScheduleItemDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @IsDateString()
  startsAt: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;
}

export class UpdateMobileScheduleItemDto extends PartialType(
  CreateMobileScheduleItemDto,
) {}

export class CreateMobileNotificationDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;
}
