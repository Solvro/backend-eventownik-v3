import { IsEmail, IsOptional } from "class-validator";

import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateParticipantDto {
  @ApiPropertyOptional({ example: "new@example.com" })
  @IsOptional()
  @IsEmail()
  email?: string;
}
