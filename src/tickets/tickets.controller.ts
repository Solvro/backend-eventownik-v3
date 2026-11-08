import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { RequirePermission } from "src/auth/permissions.decorator";
import { PermissionsGuard } from "src/auth/permissions.guard";
import { ApiPaginatedResponse } from "src/common/decorators/api-paginated-response.decorator";
import { PageDto } from "src/common/dto/page.dto";
import { PermissionType } from "src/generated/prisma/enums";

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { CreateTicketDto } from "./dto/create-ticket.dto";
import { TicketParticipantsListingDto } from "./dto/ticket-participants-listing.dto";
import { UpdateTicketDto } from "./dto/update-ticket.dto";
import { TicketParticipant } from "./entities/ticket-scan-result.entity";
import { Ticket } from "./entities/ticket.entity";
import { TicketParticipantsService } from "./ticket-participants.service";
import { TicketsService } from "./tickets.service";

@ApiTags("Tickets")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "Unauthorized" })
@ApiForbiddenResponse({ description: "Forbidden - insufficient permissions" })
@Controller("events/:eventId/tickets")
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly ticketParticipantsService: TicketParticipantsService,
  ) {}

  @Post()
  @RequirePermission(PermissionType.MANAGE_TICKET)
  @ApiOperation({ summary: "Create a ticket" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiCreatedResponse({ description: "The created ticket", type: Ticket })
  @ApiBadRequestResponse({ description: "Invalid mode, attribute or type" })
  @ApiNotFoundResponse({ description: "Event or attribute not found" })
  @ApiConflictResponse({
    description: "The event or attribute already has a ticket",
  })
  async create(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body() dto: CreateTicketDto,
  ): Promise<Ticket> {
    return this.ticketsService.create(eventId, dto);
  }

  @Get()
  @RequirePermission([PermissionType.MANAGE_TICKET, PermissionType.SCAN_TICKET])
  @ApiOperation({ summary: "Get all tickets of the event" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiOkResponse({ type: [Ticket] })
  @ApiNotFoundResponse({ description: "Event not found" })
  async findAll(
    @Param("eventId", ParseUUIDPipe) eventId: string,
  ): Promise<Ticket[]> {
    return this.ticketsService.findAll(eventId);
  }

  @Get(":ticketId")
  @RequirePermission([PermissionType.MANAGE_TICKET, PermissionType.SCAN_TICKET])
  @ApiOperation({ summary: "Get a ticket by UUID" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "ticketId", description: "UUID of the ticket" })
  @ApiOkResponse({ type: Ticket })
  @ApiNotFoundResponse({ description: "Ticket not found" })
  async findOne(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("ticketId", ParseUUIDPipe) ticketId: string,
  ): Promise<Ticket> {
    return this.ticketsService.findOne(eventId, ticketId);
  }

  @Get(":ticketId/participants")
  @RequirePermission([PermissionType.MANAGE_TICKET, PermissionType.SCAN_TICKET])
  @ApiOperation({
    summary:
      "List the participants of a ticket with the shown attributes and attendance",
  })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "ticketId", description: "UUID of the ticket" })
  @ApiPaginatedResponse(TicketParticipant)
  @ApiBadRequestResponse({ description: "blockUuid missing or not allowed" })
  @ApiNotFoundResponse({ description: "Ticket or block not found" })
  async findParticipants(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("ticketId", ParseUUIDPipe) ticketId: string,
    @Query() query: TicketParticipantsListingDto,
  ): Promise<PageDto<TicketParticipant>> {
    return this.ticketParticipantsService.findAll(eventId, ticketId, query);
  }

  @Patch(":ticketId")
  @RequirePermission(PermissionType.MANAGE_TICKET)
  @ApiOperation({ summary: "Replace the attributes shown for a ticket" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "ticketId", description: "UUID of the ticket" })
  @ApiOkResponse({ type: Ticket })
  @ApiBadRequestResponse({ description: "Attribute cannot be shown" })
  @ApiNotFoundResponse({ description: "Ticket or attribute not found" })
  async update(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("ticketId", ParseUUIDPipe) ticketId: string,
    @Body() dto: UpdateTicketDto,
  ): Promise<Ticket> {
    return this.ticketsService.update(eventId, ticketId, dto);
  }

  @Delete(":ticketId")
  @RequirePermission(PermissionType.MANAGE_TICKET)
  @ApiOperation({ summary: "Delete a ticket together with its check-ins" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "ticketId", description: "UUID of the ticket" })
  @ApiNoContentResponse({ description: "Ticket deleted" })
  @ApiNotFoundResponse({ description: "Ticket not found" })
  @HttpCode(204)
  async remove(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("ticketId", ParseUUIDPipe) ticketId: string,
  ): Promise<void> {
    await this.ticketsService.remove(eventId, ticketId);
  }
}
