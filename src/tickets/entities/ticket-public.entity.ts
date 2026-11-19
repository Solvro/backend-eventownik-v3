import { ApiProperty } from "@nestjs/swagger";

export class TicketPublicEvent {
  @ApiProperty({ example: "Eventownik Summer Fest" })
  name: string;

  @ApiProperty({ example: "2026-06-01T08:00:00.000Z" })
  startDate: Date;

  @ApiProperty({ example: "2026-06-02T18:00:00.000Z" })
  endDate: Date;

  @ApiProperty({ nullable: true, type: String, example: "Wroclaw" })
  location: string | null;

  @ApiProperty({ nullable: true, type: String, example: "#3366ff" })
  primaryColor: string | null;

  @ApiProperty({ nullable: true, type: String })
  photoUrl: string | null;
}

export class TicketPublic {
  @ApiProperty({ description: "Value to encode in the QR code" })
  token: string;

  @ApiProperty({ type: TicketPublicEvent })
  event: TicketPublicEvent;
}
