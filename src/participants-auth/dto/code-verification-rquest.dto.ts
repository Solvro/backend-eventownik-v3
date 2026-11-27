import { IsEmail, IsNotEmpty, IsString, Length } from "class-validator";
import { NormalizedEmail } from "src/common/decorators/normalized-email.decorator";

import { ApiProperty } from "@nestjs/swagger";

export class CodeVerificationRequestDTO {
  @ApiProperty({
    description: "Email of the participant",
    example: "participant@example.com",
  })
  @NormalizedEmail()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: "OTP login code",
    example: "141927",
  })
  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  code: string;
}
