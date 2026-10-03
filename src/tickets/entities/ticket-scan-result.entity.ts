import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export enum TicketScanStatus {
  VALID = "VALID",
  ALREADY_CONFIRMED = "ALREADY_CONFIRMED",
  INVALID_TICKET = "INVALID_TICKET",
  WRONG_EVENT = "WRONG_EVENT",
  WRONG_BLOCK = "WRONG_BLOCK",
}

export class TicketScanParticipant {
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  uuid: string;

  @ApiProperty({ example: "jan.kowalski@example.com" })
  email: string;
}

export class TicketScanAttribute {
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  attributeUuid: string;

  @ApiProperty({ example: "Dietary needs" })
  name: string;

  @ApiProperty({ example: "text" })
  type: string;

  @ApiProperty({
    nullable: true,
    description: "Raw stored value of the participant's attribute",
  })
  value: unknown;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    description: "Resolved block names, only for attributes of type block",
  })
  blockNames?: string[];
}

export class TicketScanResult {
  @ApiProperty({
    enum: TicketScanStatus,
    enumName: "TicketScanStatus",
  })
  status: TicketScanStatus;

  @ApiPropertyOptional({
    type: TicketScanParticipant,
    description: "Present for VALID and ALREADY_CONFIRMED",
  })
  participant?: TicketScanParticipant;

  @ApiPropertyOptional({
    type: TicketScanAttribute,
    isArray: true,
    description: "Present for VALID and ALREADY_CONFIRMED",
  })
  attributes?: TicketScanAttribute[];

  @ApiPropertyOptional({
    description: "Present for ALREADY_CONFIRMED",
    example: "2026-01-01T10:00:00.000Z",
  })
  confirmedAt?: Date;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    description:
      "Present for WRONG_BLOCK, names of the blocks the participant is in",
  })
  blockNames?: string[];
}

export class TicketCheckIn {
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  uuid: string;

  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  ticketUuid: string;

  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  participantUuid: string;

  @ApiProperty({ nullable: true, type: String })
  blockUuid: string | null;

  @ApiProperty({ example: "2026-01-01T10:00:00.000Z" })
  confirmedAt: Date;
}

export class TicketAttendance {
  @ApiProperty()
  confirmed: boolean;

  @ApiProperty({ nullable: true, type: Date })
  confirmedAt: Date | null;
}

export class TicketParticipant {
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  uuid: string;

  @ApiProperty({ example: "jan.kowalski@example.com" })
  email: string;

  @ApiProperty({ type: TicketScanAttribute, isArray: true })
  attributes: TicketScanAttribute[];

  @ApiProperty({ type: TicketAttendance })
  attendance: TicketAttendance;
}
