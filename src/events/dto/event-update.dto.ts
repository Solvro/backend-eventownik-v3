import { Equals, IsOptional } from "class-validator";

import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";

import { EventCreateDto } from "./event-create.dto";

export class EventUpdateDto extends PartialType(EventCreateDto) {
  @ApiPropertyOptional({
    description:
      "Send null (in a JSON body) to remove the event photo. To change the photo, upload a file in the multipart 'photo' field instead.",
    type: String,
    nullable: true,
    example: null,
  })
  @IsOptional()
  @Equals(null)
  photoUrl?: null;
}
