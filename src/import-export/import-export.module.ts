import { ParticipantsModule } from "src/participants/participants.module";

import { Module } from "@nestjs/common";

import { ParticipantsXlsxExporter } from "./exporters/participants-xlsx.exporter";
import { ImportExportController } from "./import-export.controller";
import { ImportExportService } from "./import-export.service";

@Module({
  imports: [ParticipantsModule],
  controllers: [ImportExportController],
  providers: [ImportExportService, ParticipantsXlsxExporter],
})
export class ImportExportModule {}
