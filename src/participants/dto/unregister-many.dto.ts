import { ArrayMinSize, IsArray, IsUUID } from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

export class UnregisterManyDto {
  @ApiProperty({
    description: "Array of participant UUIDs to unregister",
    type: [String],
  })
  @IsArray()
  @IsUUID("4", { each: true })
  @ArrayMinSize(1)
  participantsToUnregisterIds: string[];
}
