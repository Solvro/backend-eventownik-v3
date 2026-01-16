import { EventsController } from "src/events/events.controller";

import { Module } from "@nestjs/common";

import { EventsService } from "./events.service";

@Module({
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
