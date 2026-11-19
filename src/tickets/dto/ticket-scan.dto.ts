import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class TicketScanDto {
  @ApiProperty({ description: "Token read from the participant's QR code" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token: string;

  @ApiPropertyOptional({
    description:
      "UUID of the guarded block, required for BLOCK tickets and forbidden for EVENT tickets",
    example: "3d2f558c-df42-477d-bb2b-674fce2e886a",
  })
  @IsOptional()
  @IsUUID()
  blockUuid?: string;
}
