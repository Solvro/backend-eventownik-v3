import { KeycloakConnectModule } from "nest-keycloak-connect";

import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { AuthHeaderMiddleware } from "./auth/middlewares/auth-header.middleware";
import { SessionService } from "./auth/session.service";
import { ConfigModules } from "./config/config.module";
import { KeycloakConfigService } from "./config/keycloak-config.service";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    KeycloakConnectModule.registerAsync({
      useExisting: KeycloakConfigService,
      imports: [ConfigModules],
    }),
  ],
  controllers: [AppController],
  providers: [AppService, SessionService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthHeaderMiddleware).forRoutes("*"); // Apply to all routes
  }
}
