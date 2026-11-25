import { AuditLogModule } from "src/audit-log/audit-log.module";
import { ParticipantsModule } from "src/participants/participants.module";

import { Module } from "@nestjs/common";

import { ParticipantsXlsxExporter } from "./exporters/participants-xlsx.exporter";
import { ImportExportController } from "./import-export.controller";
import { ImportExportService } from "./import-export.service";

@Module({
  imports: [ParticipantsModule, AuditLogModule],
  controllers: [ImportExportController],
  providers: [ImportExportService, ParticipantsXlsxExporter],
})
export class ImportExportModule {}
