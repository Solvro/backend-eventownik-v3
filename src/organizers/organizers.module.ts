import { AuditLogModule } from "src/audit-log/audit-log.module";

import { Module } from "@nestjs/common";

import { OrganizersController } from "./organizers.controller";
import { OrganizersService } from "./organizers.service";

@Module({
  imports: [AuditLogModule],
  controllers: [OrganizersController],
  providers: [OrganizersService],
})
export class OrganizersModule {}
