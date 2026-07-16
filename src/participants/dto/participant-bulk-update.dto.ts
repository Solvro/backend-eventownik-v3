import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ParticipantBulkUpdateDto {
  @ApiProperty({
    description: "Array of participant UUIDs to update",
    isArray: true,
    example: [
      "550e8400-e29b-41d4-a716-446655440001",
      "550e8400-e29b-41d4-a716-446655440002",
    ],
  })
  @IsArray()
  @IsUUID("4", { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  participantIds: string[];

  @ApiPropertyOptional({
    description:
      "New value for the attribute. Omit or send an empty string to clear the attribute for all selected participants.",
    example: "New Value",
  })
  @IsOptional()
  @IsString()
  newValue?: string;
}
