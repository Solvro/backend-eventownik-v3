import {
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
  })
  @IsArray()
  @IsUUID("4", { each: true })
  @ArrayMinSize(1)
  participantIds: string[];

  @ApiProperty({ description: "New value for the attribute" })
  @IsString()
  @IsNotEmpty()
  newValue: string;
}
