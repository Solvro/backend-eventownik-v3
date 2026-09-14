import { MailerService } from "@nestjs-modules/mailer";
import { PrismaService } from "src/prisma/prisma.service";

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";

import { ExcelGeneratorService, ReportRow } from "./excel-generator.service";

@Injectable()
export class BbiReportService {
  private readonly logger = new Logger(BbiReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly excelGenerator: ExcelGeneratorService,
    private readonly mailerService: MailerService,
    private readonly config: ConfigService,
  ) {}

  @Cron("0 0 1 * *")
  async handleCron() {
    this.logger.log("Starting monthly BBI report generation...");
    try {
      await this.generateAndSendReport();
    } catch (error) {
      this.logger.error("Failed to generate and send BBI report", error);
    }
  }

  async generateAndSendReport(): Promise<void> {
    const events = await this.prisma.event.findMany({
      where: {
        verifiedAt: { not: null },
      },
      include: {
        attributes: true,
      },
    });

    const rowsToReport: ReportRow[] = [];
    const eventsToUpdate: string[] = [];
    const attributesToUpdate: string[] = [];

    let index = 1;

    for (const event of events) {
      const isEventNew = event.sentToBbiAt == null;

      const newOrModifiedAttributes = event.attributes.filter((attribute) => {
        if (attribute.sentToBbiAt == null) {
          return true;
        }
        return attribute.updatedAt > attribute.sentToBbiAt;
      });

      if (isEventNew || newOrModifiedAttributes.length > 0) {
        const attributesListString = newOrModifiedAttributes
          .map((a) => `- ${a.name}`)
          .join("\n");

        const attributesString = `Dla organizatorów:\n- adres email\n- imię\n- nazwisko\n- jednostka\n- hasło utworzone w systemie\n- powiązanie z systemem USOS (index)\n\nNiestandardowe atrybuty uczestników, zbierane automatycznie poprzez uzupełnianie formularzy związanych z wydarzeniem:\n${attributesListString}`;

        rowsToReport.push({
          index: index++,
          eventName: event.name,
          organizerName: event.organizerName ?? "Nieznany organizator",
          endDate: event.endDate,
          attributesStr: attributesString,
        });

        eventsToUpdate.push(event.uuid);
        attributesToUpdate.push(...newOrModifiedAttributes.map((a) => a.uuid));
      }
    }

    if (rowsToReport.length === 0) {
      this.logger.log(
        "No new or modified events/attributes to report. Skipping email.",
      );
      return;
    }

    const excelBuffer =
      await this.excelGenerator.generateBbiReport(rowsToReport);

    const emailTo = this.config.getOrThrow<string>("BBI_EMAIL");
    const dateString = new Date().toISOString().slice(0, 10);
    const filename = `RCP_raport_${dateString}.xlsx`;

    await this.mailerService.sendMail({
      to: emailTo,
      subject: `Raport RCP za miesiąc - ${dateString}`,
      text: "W załączniku znajduje się comiesięczny raport RCP (Rejestr Czynności Przetwarzania).",
      attachments: [
        {
          filename,
          content: excelBuffer,
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
    });

    this.logger.log(
      `BBI report sent to ${emailTo} with ${rowsToReport.length.toString()} events.`,
    );

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.event.updateMany({
        where: { uuid: { in: eventsToUpdate } },
        data: { sentToBbiAt: now },
      }),
      this.prisma.attribute.updateMany({
        where: { uuid: { in: attributesToUpdate } },
        data: { sentToBbiAt: now },
      }),
    ]);

    this.logger.log("BBI report metadata (sentToBbiAt) updated successfully.");
  }
}
