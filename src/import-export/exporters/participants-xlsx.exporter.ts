import * as ExcelJS from "exceljs";

import { Injectable } from "@nestjs/common";

import { ParticipantsExportFormat } from "../dto/export-participants-query.dto";
import { buildAttributeHeaders } from "../utils/attribute-headers";
import {
  ParticipantsExportPayload,
  ParticipantsExporter,
} from "./participants-exporter.interface";

@Injectable()
export class ParticipantsXlsxExporter implements ParticipantsExporter {
  readonly format = ParticipantsExportFormat.xlsx;
  readonly mimeType =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  readonly fileExtension = "xlsx";

  async build(payload: ParticipantsExportPayload): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Participants");

    const headers = [
      "participantUuid",
      "email",
      ...buildAttributeHeaders(payload.attributes),
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
}
