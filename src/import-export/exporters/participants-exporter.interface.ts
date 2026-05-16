import { ParticipantsExportFormat } from "../dto/export-participants-query.dto";

export type ParticipantsExportAttribute = {
  uuid: string;
  name: string;
};

export type ParticipantsExportRow = {
  participantUuid: string;
  email: string;
  attributes: Record<string, string>;
};

export type ParticipantsExportPayload = {
  attributes: ParticipantsExportAttribute[];
  rows: ParticipantsExportRow[];
};

export interface ParticipantsExporter {
  readonly format: ParticipantsExportFormat;
  readonly mimeType: string;
  readonly fileExtension: string;
  build(payload: ParticipantsExportPayload): Promise<Buffer>;
}
