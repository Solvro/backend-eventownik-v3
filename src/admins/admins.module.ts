import { Module } from "@nestjs/common";

import { AdminsController } from "./admins.controller";
import { AdminsService } from "./admins.service";

@Module({
  providers: [AdminsService],
  exports: [AdminsService],
  controllers: [AdminsController],
})
export class AdminsModule {}
