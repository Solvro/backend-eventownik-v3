import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import type { AuthUser } from "src/auth/jwt.strategy";
import { RequirePermission } from "src/auth/permissions.decorator";
import { PermissionsGuard } from "src/auth/permissions.guard";
import { PermissionType } from "src/generated/prisma/enums";

import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import { TicketScanDto } from "./dto/ticket-scan.dto";
import {
  TicketCheckIn,
  TicketScanResult,
} from "./entities/ticket-scan-result.entity";
import { TicketScanService } from "./ticket-scan.service";

@ApiTags("Tickets")
@UseGuards(JwtAuthGuard, PermissionsGuard, ThrottlerGuard)
@Throttle({ default: { limit: 300, ttl: 60_000 } })
@RequirePermission(PermissionType.SCAN_TICKET)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "Unauthorized" })
@ApiForbiddenResponse({ description: "Forbidden - insufficient permissions" })
@Controller("events/:eventId/tickets/:ticketId")
export class TicketScanController {
  constructor(private readonly ticketScanService: TicketScanService) {}

  @Post("scan")
  @HttpCode(200)
  @ApiOperation({
    summary: "Look up a scanned ticket without confirming attendance",
  })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "ticketId", description: "UUID of the ticket" })
  @ApiOkResponse({ type: TicketScanResult })
  @ApiBadRequestResponse({ description: "blockUuid missing or not allowed" })
  @ApiNotFoundResponse({ description: "Ticket or block not found" })
  async scan(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("ticketId", ParseUUIDPipe) ticketId: string,
    @Body() dto: TicketScanDto,
  ): Promise<TicketScanResult> {
    return this.ticketScanService.scan(eventId, ticketId, dto);
  }

  @Post("check-ins")
  @ApiOperation({ summary: "Confirm attendance for a scanned ticket" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "ticketId", description: "UUID of the ticket" })
  @ApiCreatedResponse({ type: TicketCheckIn })
  @ApiBadRequestResponse({ description: "blockUuid missing or not allowed" })
  @ApiNotFoundResponse({ description: "Ticket or block not found" })
  @ApiConflictResponse({ description: "Ticket already confirmed" })
  @ApiUnprocessableEntityResponse({
    description: "Invalid ticket, wrong event or wrong block",
  })
  async confirm(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("ticketId", ParseUUIDPipe) ticketId: string,
    @Body() dto: TicketScanDto,
    @Req() request: { user: AuthUser },
  ): Promise<TicketCheckIn> {
    return this.ticketScanService.confirm(
      eventId,
      ticketId,
      dto,
      request.user.uuid,
    );
  }
}
