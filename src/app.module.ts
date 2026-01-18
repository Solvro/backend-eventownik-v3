import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { EventsModule } from "./events/events.module";
import { FormsModule } from "./forms/forms.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [PrismaModule, EventsModule, FormsModule, ConfigModule.forRoot()],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
