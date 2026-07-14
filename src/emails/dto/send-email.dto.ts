import { ArrayNotEmpty, IsUUID } from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

export class SendEmailDto {
  @ApiProperty({
    type: String,
    isArray: true,
    description: "UUIDs of the participants to send this email to",
  })
  @IsUUID(4, { each: true })
  @ArrayNotEmpty()
  participantUuids: string[];
}
