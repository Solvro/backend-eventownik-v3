import {
  EventsController,
  PublicEventsController,
} from "src/events/events.controller";

import { Module } from "@nestjs/common";

import { EventsService } from "./events.service";

@Module({
  controllers: [EventsController, PublicEventsController],
  providers: [EventsService],
})
export class EventsModule {}
