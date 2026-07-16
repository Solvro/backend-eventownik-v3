import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { EmailContentParserService } from "./email-content-parser.service";
import { EmailDeliveryService } from "./email-delivery.service";
import { EmailTemplatesService } from "./email-templates.service";
import { EMAIL_QUEUE_NAME } from "./emails.constants";
import { EmailsConsumer } from "./emails.consumer";
import { EmailsController } from "./emails.controller";
import { EmailsListeners } from "./emails.listeners";

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: EMAIL_QUEUE_NAME,
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
  providers: [
    EmailTemplatesService,
    EmailContentParserService,
    EmailDeliveryService,
    EmailsConsumer,
    EmailsListeners,
  ],
})
export class EmailsModule {}
