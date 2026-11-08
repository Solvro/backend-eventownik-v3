import type { SignOptions } from "jsonwebtoken";

import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { PrismaModule } from "../prisma/prisma.module";
import { AUTH_EMAIL_QUEUE_NAME } from "./auth-email.constants";
import { AuthEmailConsumer } from "./auth-email.consumer";
import { AuthEmailService } from "./auth-email.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { PermissionsGuard } from "./permissions.guard";

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: configService.getOrThrow<string>(
            "JWT_EXPIRES_IN",
          ) as SignOptions["expiresIn"],
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: AUTH_EMAIL_QUEUE_NAME,
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
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    PermissionsGuard,
    AuthEmailService,
    AuthEmailConsumer,
  ],
  exports: [AuthService, JwtModule, PermissionsGuard],
})
export class AuthModule {}
