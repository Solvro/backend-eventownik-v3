import { ArrayUnique, IsArray, IsUUID } from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

export class UpdateTicketDto {
  @ApiProperty({
    description: "UUIDs of the attributes shown to the scanning staff",
    type: String,
    isArray: true,
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID("all", { each: true })
  shownAttributeUuids: string[];
}
