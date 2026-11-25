import { AuditLogModule } from "src/audit-log/audit-log.module";
import { BlocksModule } from "src/blocks/blocks.module";

import { Module } from "@nestjs/common";

import { AttributesController } from "./attributes.controller";
import { AttributesService } from "./attributes.service";

@Module({
  imports: [BlocksModule, AuditLogModule],
  controllers: [AttributesController],
  providers: [AttributesService],
})
export class AttributesModule {}
