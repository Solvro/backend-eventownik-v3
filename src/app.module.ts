import { HcaptchaModule } from "@gvrs/nestjs-hcaptcha";
import { MailerModule } from "@nestjs-modules/mailer";
import { HandlebarsAdapter } from "@nestjs-modules/mailer/dist/adapters/handlebars.adapter";
import * as Joi from "joi";
import path from "node:path";

import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";

import { AdminsModule } from "./admins/admins.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AttributesModule } from "./attributes/attributes.module";
import { AuditLogModule } from "./audit-log/audit-log.module";
import { AuthModule } from "./auth/auth.module";
import { BlocksModule } from "./blocks/blocks.module";
import { EmailsModule } from "./emails/emails.module";
import { EventsModule } from "./events/events.module";
import { FormsModule } from "./forms/forms.module";
import { ImportExportModule } from "./import-export/import-export.module";
import { OrganizersModule } from "./organizers/organizers.module";
import { ParticipantsModule } from "./participants/participants.module";
import { PrismaModule } from "./prisma/prisma.module";
import { StorageModule } from "./storage/storage.module";

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    AuditLogModule,
    FormsModule,
    ConfigModule.forRoot({
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid("development", "test", "production")
          .default("development"),
        APP_DOMAIN: Joi.string().required(),
        FRONTEND_URL: Joi.string().required(),
        CORS_ORIGINS: Joi.string().required(),
        DATABASE_URL: Joi.string().required(),
        HCAPTCHA_SECRET: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRES_IN: Joi.string().default("60m"),
        REFRESH_TOKEN_TTL_DAYS: Joi.number().required().default(3),
        PORT: Joi.number().default(3000),
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().required(),
        REDIS_USER: Joi.string().allow("").optional(),
        REDIS_PASS: Joi.string().allow("").optional(),
        SMTP_HOST: Joi.string().required(),
        SMTP_PORT: Joi.number().required(),
        SMTP_SECURE: Joi.boolean().default(false),
        SMTP_USER: Joi.string().required(),
        SMTP_PASS: Joi.string().required(),
        SMTP_FROM: Joi.string().required(),
        S3_ENDPOINT: Joi.string().required(),
        S3_ACCESS_KEY: Joi.string().required(),
        S3_SECRET_KEY: Joi.string().required(),
        S3_BUCKET_EVENTS: Joi.string().required(),
        S3_BUCKET_FORMS: Joi.string().required(),
        S3_PUBLIC_URL: Joi.string().required(),
        UPLOAD_MAX_FILE_SIZE: Joi.number().default(10_485_760),
        UPLOAD_ALLOWED_MIME: Joi.string().default(
          "application/pdf,image/jpeg,image/png,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
        UPLOAD_TTL_HOURS: Joi.number().default(24),
      }),
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    ScheduleModule.forRoot(),
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
        template: {
          dir: path.join(process.cwd(), "dist", "common", "templates"),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
    }),
    EventEmitterModule.forRoot({
      wildcard: true,
    }),
    PrismaModule,
    EventsModule,
    FormsModule,
    OrganizersModule,
    AuthModule,
    AttributesModule,
    BlocksModule,
    AdminsModule,
    ParticipantsModule,
    ImportExportModule,
    HcaptchaModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>("HCAPTCHA_SECRET"),
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.getOrThrow<string>("REDIS_HOST"),
          port: configService.getOrThrow<number>("REDIS_PORT"),
          username: configService.get<string | undefined>("REDIS_USER"),
          password: configService.get<string | undefined>("REDIS_PASS"),
        },
      }),
    }),
    EmailsModule,
    StorageModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
