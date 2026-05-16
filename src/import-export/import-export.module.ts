import { PrismaModule } from "src/prisma/prisma.module";

import { Module } from "@nestjs/common";

import { ParticipantsXlsxExporter } from "./exporters/participants-xlsx.exporter";
import { ImportExportController } from "./import-export.controller";
import { ImportExportService } from "./import-export.service";

@Module({
  imports: [PrismaModule],
  controllers: [ImportExportController],
  providers: [ImportExportService, ParticipantsXlsxExporter],
})
export class ImportExportModule {}
