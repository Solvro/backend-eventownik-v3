import { Module } from "@nestjs/common";

import { EmailsController } from "./emails.controller";
import { EmailsService } from "./emails.service";

@Module({
  controllers: [EmailsController],
  providers: [EmailsService],
})
export class EmailsModule {}
