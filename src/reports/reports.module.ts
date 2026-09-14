import { PrismaModule } from "src/prisma/prisma.module";

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { BbiReportService } from "./bbi-report.service";
import { ExcelGeneratorService } from "./excel-generator.service";

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [BbiReportService, ExcelGeneratorService],
  exports: [BbiReportService],
})
export class ReportsModule {}
