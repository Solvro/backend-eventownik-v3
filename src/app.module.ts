import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AdminsModule } from "./admins/admins.module";
import { AdminsService } from "./admins/admins.service";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { EventsModule } from "./events/events.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    ConfigModule.forRoot(),
    AuthModule,
    AdminsModule,
  ],
  controllers: [AppController],
  providers: [AppService, AdminsService],
})
export class AppModule {}
