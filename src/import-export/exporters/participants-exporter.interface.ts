import type { ParticipantsExportFormat } from "../dto/export-participants-query.dto";

export interface ParticipantsExportAttribute {
  uuid: string;
  name: string;
}

export interface ParticipantsExportRow {
  participantUuid: string;
  email: string;
  attributes: Record<string, string>;
}

export interface ParticipantsExportPayload {
  attributes: ParticipantsExportAttribute[];
  rows: ParticipantsExportRow[];
}

export interface ParticipantsExporter {
  readonly format: ParticipantsExportFormat;
  readonly mimeType: string;
  readonly fileExtension: string;
  build: (payload: ParticipantsExportPayload) => Promise<Buffer>;
}
