import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

export class UnregisterManyDto {
  @ApiProperty({
    description: "Array of participant UUIDs to unregister",
    type: String,
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
  participantsToUnregisterIds: string[];
}
