/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
import { MailerService } from "@nestjs-modules/mailer";
import { PrismaService } from "src/prisma/prisma.service";

import { ConfigService } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { BbiReportService } from "./bbi-report.service";
import { ExcelGeneratorService } from "./excel-generator.service";

describe("BbiReportService", () => {
  let service: BbiReportService;
  let prismaService: jest.Mocked<PrismaService>;
  let excelGeneratorService: jest.Mocked<ExcelGeneratorService>;
  let mailerService: jest.Mocked<MailerService>;

  beforeEach(async () => {
    const mockPrisma = {
      event: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      attribute: {
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockExcel = {
      generateBbiReport: jest
        .fn()
        .mockResolvedValue(Buffer.from("dummy-excel-data")),
    };

    const mockMailer = {
      sendMail: jest.fn().mockResolvedValue(true),
    };

    const mockConfig = {
      getOrThrow: jest.fn().mockReturnValue("test@test.com"),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BbiReportService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ExcelGeneratorService, useValue: mockExcel },
        { provide: MailerService, useValue: mockMailer },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<BbiReportService>(BbiReportService);
    prismaService = module.get(PrismaService);
    excelGeneratorService = module.get(ExcelGeneratorService);
    mailerService = module.get(MailerService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should skip email if no events to report", async () => {
    (prismaService.event.findMany as jest.Mock).mockResolvedValue([]);

    await service.generateAndSendReport();

    expect(excelGeneratorService.generateBbiReport).not.toHaveBeenCalled();
    expect(mailerService.sendMail).not.toHaveBeenCalled();
    expect(prismaService.$transaction).not.toHaveBeenCalled();
  });

  it("should send email and update database if there are new events", async () => {
    const mockDate = new Date("2024-01-01T00:00:00Z");
    const testEvent = {
      uuid: "event-1",
      name: "New Event",
      organizerName: "Org",
      endDate: mockDate,
      sentToBbiAt: null, // new event
      attributes: [],
    } as any;

    (prismaService.event.findMany as jest.Mock).mockResolvedValue([testEvent]);

    await service.generateAndSendReport();

    expect(excelGeneratorService.generateBbiReport).toHaveBeenCalledTimes(1);
    expect(mailerService.sendMail).toHaveBeenCalledTimes(1);
    expect(prismaService.$transaction).toHaveBeenCalledTimes(1);

    expect(mailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "test@test.com",
        attachments: expect.arrayContaining([
          expect.objectContaining({
            content: expect.any(Buffer),
          }),
        ]),
      }),
    );
  });

  it("should send email and update database if there are new attributes", async () => {
    const mockDate = new Date("2024-01-01T00:00:00Z");
    const testEvent = {
      uuid: "event-1",
      name: "Event",
      organizerName: "Org",
      endDate: mockDate,
      sentToBbiAt: new Date("2023-01-01T00:00:00Z"), // old event
      attributes: [
        {
          uuid: "attr-1",
          name: "New Attr",
          sentToBbiAt: null, // new attribute
          updatedAt: new Date(),
        },
      ],
    } as any;

    (prismaService.event.findMany as jest.Mock).mockResolvedValue([testEvent]);

    await service.generateAndSendReport();

    expect(excelGeneratorService.generateBbiReport).toHaveBeenCalledTimes(1);
    expect(mailerService.sendMail).toHaveBeenCalledTimes(1);
    expect(prismaService.$transaction).toHaveBeenCalledTimes(1);
  });
});
