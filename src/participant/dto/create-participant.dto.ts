import { IsEmail, IsNotEmpty } from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

export class CreateParticipantDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
