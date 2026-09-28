import { Participant } from "src/participants/entities/participant.entity";

import { ApiProperty } from "@nestjs/swagger";

export type ImportSkipReason =
  | "already_exists"
  | "duplicate_in_file"
  | "failed";

export class SkippedParticipantDto {
  @ApiProperty({ example: "jan@example.com" })
  email: string;

  @ApiProperty({ enum: ["already_exists", "duplicate_in_file", "failed"] })
  reason: ImportSkipReason;

  @ApiProperty({ example: "Participant with this email already exists" })
  message: string;
}

export class ParticipantsImportResultDto {
  @ApiProperty({ type: Participant, isArray: true })
  importedParticipants: Participant[];

  @ApiProperty({ type: SkippedParticipantDto, isArray: true })
  skippedParticipants: SkippedParticipantDto[];
}
