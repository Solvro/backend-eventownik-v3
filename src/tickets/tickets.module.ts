import { Module } from "@nestjs/common";

import { TicketParticipantsService } from "./ticket-participants.service";
import { TicketScanController } from "./ticket-scan.controller";
import { TicketScanService } from "./ticket-scan.service";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";

@Module({
  controllers: [TicketsController, TicketScanController],
  providers: [TicketsService, TicketScanService, TicketParticipantsService],
  exports: [TicketsService],
})
export class TicketsModule {}
