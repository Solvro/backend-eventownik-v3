// src/auth/auth.module.ts
import {
  AuthGuard,
  KeycloakConnectModule,
  RoleGuard,
} from "nest-keycloak-connect";

import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { PassportModule } from "@nestjs/passport";

import { KeycloakConfigService } from "../config/keycloak-config.service";
import { AuthController } from "./auth.controller";
import { SessionAuthGuard } from "./guards/session-auth.guard";
import { KeycloakStrategy } from "./keycloak.strategy";
import { SessionService } from "./session.service";

@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [SessionService, KeycloakStrategy, SessionAuthGuard],
  exports: [SessionService],
})
export class AuthModule {}
