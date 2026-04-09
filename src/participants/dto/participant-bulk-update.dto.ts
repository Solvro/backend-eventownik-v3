import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
} from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

export class ParticipantBulkUpdateDto {
  @ApiProperty({
    description: "Array of participant UUIDs to update",
    type: [String],
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

  @ApiProperty({
    description: "New value for the attribute",
    example: "New Value",
  })
  @IsString()
  @IsNotEmpty()
  newValue: string;
}
