import { EventsController } from "src/events/events.controller";
import { PrismaModule } from "src/prisma/prisma.module";

import { Module } from "@nestjs/common";

@Module({
  imports: [PrismaModule],
  controllers: [EventsController],
})
export class EventsModule {}
