import { Module } from "@nestjs/common";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AttributesModule } from "./attributes/attributes.module";
import { EventsModule } from "./events/events.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [PrismaModule, EventsModule, AttributesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
