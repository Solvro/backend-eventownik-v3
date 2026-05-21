import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { EmailsConsumer } from "./emails.consumer";
import { EmailsController } from "./emails.controller";
import { EmailsService } from "./emails.service";

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: "automatic-emails",
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          delay: 1000,
          type: "exponential",
        },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    }),
  ],
  controllers: [EmailsController],
  providers: [EmailsService, EmailsConsumer],
})
export class EmailsModule {}
