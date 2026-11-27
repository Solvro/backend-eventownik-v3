import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class MobileProfileDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  displayName: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string | null;

  @IsOptional()
  @IsBoolean()
  tinderOptIn?: boolean;
}
