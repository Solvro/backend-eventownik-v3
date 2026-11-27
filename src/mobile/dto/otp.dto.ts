import { Transform } from "class-transformer";
import { IsEmail, IsString, Matches, MaxLength } from "class-validator";

const normaliseEmail = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

export class MobileOtpRequestDto {
  @Transform(normaliseEmail)
  @IsEmail()
  @MaxLength(320)
  email: string;
}

export class MobileOtpVerifyDto {
  @Transform(normaliseEmail)
  @IsEmail()
  @MaxLength(320)
  email: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @Matches(/^\d{6}$/, { message: "code must be 6 digits" })
  code: string;
}
