import * as ExcelJS from "exceljs";

import { Injectable } from "@nestjs/common";

import {
  ParticipantsExportPayload,
  ParticipantsExporter,
} from "./participants-exporter.interface";

@Injectable()
export class ParticipantsXlsxExporter implements ParticipantsExporter {
  readonly format = "xlsx" as const;
  readonly mimeType =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  readonly fileExtension = "xlsx";

  async build(payload: ParticipantsExportPayload): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Participants");

    const headers = [
      "participantUuid",
      "email",
      ...this.getUniqueAttributeHeaders(payload.attributes),
    ];
    worksheet.addRow(headers);

    for (const row of payload.rows) {
      worksheet.addRow([
        row.participantUuid,
        row.email,
        ...payload.attributes.map(
          (attribute) => row.attributes[attribute.uuid] ?? "",
        ),
      ]);
    }

    const firstRow = worksheet.getRow(1);
    firstRow.font = { bold: true };
    for (const column of worksheet.columns) {
      column.width = 25;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private getUniqueAttributeHeaders(
    attributes: ParticipantsExportPayload["attributes"],
  ): string[] {
    const headerCounts = new Map<string, number>();

    return attributes.map((attribute) => {
      const baseHeader =
        attribute.name.trim().length > 0 ? attribute.name : "N/A";
      const count = (headerCounts.get(baseHeader) ?? 0) + 1;
      headerCounts.set(baseHeader, count);

      if (count === 1) {
        return baseHeader;
      }

      return `${baseHeader} (${attribute.uuid})`;
    });
  }
}
