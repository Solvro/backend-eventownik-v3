import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { AuditLogQueryService } from "./audit-log-query.service";
import { AuditLogController } from "./audit-log.controller";
import { AuditLogService } from "./audit-log.service";

@Module({
  imports: [PrismaModule],
  controllers: [AuditLogController],
  providers: [AuditLogService, AuditLogQueryService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
