import { ArrayMinSize, ArrayUnique, IsArray, IsUUID } from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

export class ReorderEmailsDto {
  @ApiProperty({
    description:
      "Email template UUIDs in the desired order. Each template gets its position in this list as its order. Templates not listed keep their current order.",
    isArray: true,
    type: String,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  emailIds: string[];
}
