import { TicketMode } from "src/generated/prisma/enums";

import { ApiProperty } from "@nestjs/swagger";

export class Ticket {
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  uuid: string;

  @ApiProperty({ example: "2d1b8d5e-5d0a-4c0e-8d3c-6a6a8b1c4f10" })
  eventUuid: string;

  @ApiProperty({ enum: TicketMode, example: TicketMode.BLOCK })
  mode: TicketMode;

  @ApiProperty({
    example: "d687428d-7e3a-46f6-92a0-cef84e51b171",
    nullable: true,
    description: "Block attribute the ticket is for, null for EVENT tickets",
  })
  attributeUuid: string | null;

  @ApiProperty({ type: String, isArray: true })
  shownAttributeUuids: string[];

  @ApiProperty({ example: "2023-01-01T00:00:00.000Z" })
  createdAt: Date;

  @ApiProperty({ example: "2023-01-01T00:00:00.000Z" })
  updatedAt: Date;
}
