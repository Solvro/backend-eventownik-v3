import { Transform } from "class-transformer";
import { IsArray, IsIn, IsOptional, IsUUID } from "class-validator";

import { ApiPropertyOptional } from "@nestjs/swagger";

export const PARTICIPANTS_EXPORT_FORMATS = ["xlsx"] as const;
export type ParticipantsExportFormat =
  (typeof PARTICIPANTS_EXPORT_FORMATS)[number];

function parseUuidList(value: unknown): string[] | undefined {
  if (value == null || value === "") {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((item) =>
        typeof item === "string" ? item.split(",") : [String(item)],
      )
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return undefined;
}

export class ExportParticipantsQueryDto {
  @ApiPropertyOptional({
    description: "Export format",
    enum: PARTICIPANTS_EXPORT_FORMATS,
    default: "xlsx",
  })
  @IsOptional()
  @IsIn(PARTICIPANTS_EXPORT_FORMATS)
  readonly format?: ParticipantsExportFormat = "xlsx";

  @ApiPropertyOptional({
    description:
      "Participant UUIDs to include in export (comma-separated or repeated query param). When omitted, all event participants are exported.",
    type: [String],
    example:
      "participantIds=7ee3f11b-6ddb-4be6-bf73-11be7448f724,12849640-4b09-4875-bfd0-01fe6d61c252",
  })
  @IsOptional()
  @Transform(({ value }) => parseUuidList(value))
  @IsArray()
  @IsUUID(undefined, { each: true })
  readonly participantIds?: string[];

  @ApiPropertyOptional({
    description:
      "Attribute UUIDs to include in export (comma-separated or repeated query param). When omitted, all event attributes are exported.",
    type: [String],
    example:
      "attributeIds=8ca6f6a5-8f2e-4b3f-a3df-ea7488de1b67,0dcb795a-a54a-4ae4-a4a9-0f97c2f4da95",
  })
  @IsOptional()
  @Transform(({ value }) => parseUuidList(value))
  @IsArray()
  @IsUUID(undefined, { each: true })
  readonly attributeIds?: string[];
}
