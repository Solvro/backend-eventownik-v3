import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { EmailsConsumer } from "./emails.consumer";
import { EmailsController } from "./emails.controller";
import { EmailsService } from "./emails.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "automatic-emails",
    }),
  ],
  controllers: [EmailsController],
  providers: [EmailsService, EmailsConsumer],
})
export class EmailsModule {}
