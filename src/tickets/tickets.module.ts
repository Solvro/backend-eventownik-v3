import { Module } from "@nestjs/common";

import { TicketParticipantsService } from "./ticket-participants.service";
import { TicketPublicController } from "./ticket-public.controller";
import { TicketPublicService } from "./ticket-public.service";
import { TicketScanController } from "./ticket-scan.controller";
import { TicketScanService } from "./ticket-scan.service";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";

@Module({
  controllers: [
    TicketsController,
    TicketScanController,
    TicketPublicController,
  ],
  providers: [
    TicketsService,
    TicketScanService,
    TicketParticipantsService,
    TicketPublicService,
  ],
  exports: [TicketsService],
})
export class TicketsModule {}
