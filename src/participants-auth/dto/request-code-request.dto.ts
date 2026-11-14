import { IsEmail, IsNotEmpty } from "class-validator";
import { NormalizedEmail } from "src/common/decorators/normalized-email.decorator";

import { ApiProperty } from "@nestjs/swagger";

export class RequestLoginCodeRequestDTO {
  @ApiProperty({
    description: "Email of the participant",
    example: "participant@example.com",
  })
  @NormalizedEmail()
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
