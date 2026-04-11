import { ApiProperty } from "@nestjs/swagger";

export class ParticipantAttribute {
  @ApiProperty({ description: "UUID of the attribute" })
  uuid: string;

  @ApiProperty({ description: "Name of the attribute" })
  name: string;

  @ApiProperty({
    description: "Value of the attribute",
    nullable: true,
  })
  value: string | null;

  @ApiProperty({ description: "Creation date" })
  createdAt: Date;

  @ApiProperty({ description: "Last update date" })
  updatedAt: Date;
}
