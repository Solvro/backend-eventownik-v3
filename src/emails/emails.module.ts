import { MailerModule } from "@nestjs-modules/mailer";

import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { EmailsController } from "./emails.controller";
import { EmailsService } from "./emails.service";

@Module({
  controllers: [EmailsController],
  providers: [EmailsService],
})
export class EmailsModule {}
