import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { ParticipantAttribute } from "./participant-attribute.entity";
import { ParticipantEmailStatus } from "./participant-email-status.entity";

export class Participant {
  @ApiProperty({ description: "UUID of the participant" })
  uuid: string;

  @ApiProperty({ description: "Email of the participant" })
  email: string;

  @ApiProperty({ description: "Creation date" })
  createdAt: Date;

  @ApiProperty({
    isArray: true,
    description: "List of attributes associated with the participant",
  })
  attributes: ParticipantAttribute[];

  @ApiPropertyOptional({
    isArray: true,
    description: "List of email statuses for the participant",
  })
  emails?: ParticipantEmailStatus[];
}
