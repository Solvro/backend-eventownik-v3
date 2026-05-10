import { MailerModule } from "@nestjs-modules/mailer";

import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { EmailsController } from "./emails.controller";
import { EmailsService } from "./emails.service";

@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.getOrThrow<string>("SMTP_HOST"),
          port: configService.getOrThrow<number>("SMTP_PORT"),
          secure: configService.getOrThrow<boolean>("SMTP_SECURE"),
          auth: {
            user: configService.getOrThrow<string>("SMTP_USER"),
            pass: configService.getOrThrow<string>("SMTP_PASS"),
          },
        },
        defaults: {
          from: configService.getOrThrow<string>("SMTP_FROM"),
        },
      }),
    }),
  ],
  controllers: [EmailsController],
  providers: [EmailsService],
})
export class EmailsModule {}
