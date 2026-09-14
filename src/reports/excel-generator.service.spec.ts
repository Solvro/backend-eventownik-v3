import * as ExcelJS from "exceljs";

import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { ExcelGeneratorService } from "./excel-generator.service";

describe("ExcelGeneratorService", () => {
  let service: ExcelGeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExcelGeneratorService],
    }).compile();

    service = module.get<ExcelGeneratorService>(ExcelGeneratorService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should generate a valid excel buffer", async () => {
    const buffer = await service.generateBbiReport([
      {
        index: 1,
        eventName: "Test Event",
        organizerName: "Test Organizer",
        endDate: new Date("2025-01-01"),
        attributesStr: "- Custom attribute",
      },
    ]);

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.getWorksheet("RCP");
    if (sheet == null) {
      throw new Error("Sheet not found");
    }

    const firstRow = sheet.getRow(1);
    expect(firstRow.getCell(2).value).toBe("Nazwa wydarzenia");

    const secondRow = sheet.getRow(2);
    expect(secondRow.getCell(2).value).toBe("Test Event");
    expect(secondRow.getCell(6).value).toContain("Test Organizer");
  });
});
