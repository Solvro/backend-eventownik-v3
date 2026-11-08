import { IsEmail, IsOptional, IsUUID } from "class-validator";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SendTestEmailDto {
  @ApiProperty({ example: "admin@example.com" })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description:
      "Participant UUID to source real data from; if omitted, a placeholder participant is used",
  })
  @IsOptional()
  @IsUUID()
  participantUuid?: string;
}
