import * as ExcelJS from "exceljs";

import { ParticipantsXlsxExporter } from "./participants-xlsx.exporter";

async function readSheet(buffer: Buffer): Promise<unknown[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const worksheet = workbook.getWorksheet("Participants");
  const rows: unknown[][] = [];
  worksheet?.eachRow((row) => {
    rows.push((row.values as unknown[]).slice(1));
  });
  return rows;
}

describe("ParticipantsXlsxExporter", () => {
  const exporter = new ParticipantsXlsxExporter();
  const consentedAt = new Date("2026-10-01T10:00:00.000Z");

  const rows = [
    {
      participantUuid: "p-1",
      email: "consented@example.com",
      attributes: {},
      consent: {
        gdprConsent: true,
        gdprConsentAt: consentedAt,
        ip: "203.0.113.5",
        userAgent: "jest-agent",
      },
    },
    {
      participantUuid: "p-2",
      email: "imported@example.com",
      attributes: {},
      consent: {
        gdprConsent: false,
        gdprConsentAt: null,
        ip: null,
        userAgent: null,
      },
    },
  ];

  it("should not add consent columns by default", async () => {
    const buffer = await exporter.build({
      attributes: [],
      includeConsent: false,
      rows,
    });

    const sheet = await readSheet(buffer);
    expect(sheet[0]).toEqual(["participantUuid", "email"]);
    expect(sheet[1]).toEqual(["p-1", "consented@example.com"]);
  });

  it("should add consent columns after email when includeConsent is set", async () => {
    const buffer = await exporter.build({
      attributes: [],
      includeConsent: true,
      rows,
    });

    const sheet = await readSheet(buffer);
    expect(sheet[0]).toEqual([
      "participantUuid",
      "email",
      "gdprConsent",
      "gdprConsentAt",
      "consentIp",
      "consentUserAgent",
    ]);
    expect(sheet[1]).toEqual([
      "p-1",
      "consented@example.com",
      true,
      consentedAt.toISOString(),
      "203.0.113.5",
      "jest-agent",
    ]);
    expect(sheet[2]).toEqual([
      "p-2",
      "imported@example.com",
      false,
      "",
      "",
      "",
    ]);
  });
});
