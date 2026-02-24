import { IsNotEmpty, IsString } from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

export class RefreshTokenDto {
  @ApiProperty({
    description: "The refresh token",
    example: "refresh-token-string",
  })
  @IsString()
  @IsNotEmpty()
  refresh_token!: string;
}
