import { Module } from "@nestjs/common";

import { TicketScanController } from "./ticket-scan.controller";
import { TicketScanService } from "./ticket-scan.service";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";

@Module({
  controllers: [TicketsController, TicketScanController],
  providers: [TicketsService, TicketScanService],
  exports: [TicketsService],
})
export class TicketsModule {}
