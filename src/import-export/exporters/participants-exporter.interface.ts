import type { ParticipantsExportFormat } from "../dto/export-participants-query.dto";

export interface ParticipantsExportAttribute {
  uuid: string;
  name: string;
}

export interface ParticipantsExportConsent {
  gdprConsent: boolean;
  gdprConsentAt: Date | null;
  ip: string | null;
  userAgent: string | null;
}

export interface ParticipantsExportRow {
  participantUuid: string;
  email: string;
  attributes: Record<string, string>;
  consent?: ParticipantsExportConsent;
}

export interface ParticipantsExportPayload {
  attributes: ParticipantsExportAttribute[];
  rows: ParticipantsExportRow[];
  includeConsent: boolean;
}

export interface ParticipantsExporter {
  readonly format: ParticipantsExportFormat;
  readonly mimeType: string;
  readonly fileExtension: string;
  build: (payload: ParticipantsExportPayload) => Promise<Buffer>;
}
