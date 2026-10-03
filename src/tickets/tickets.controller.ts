import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { RequirePermission } from "src/auth/permissions.decorator";
import { PermissionsGuard } from "src/auth/permissions.guard";
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
import { UpdateTicketDto } from "./dto/update-ticket.dto";
import { Ticket } from "./entities/ticket.entity";
import { TicketsService } from "./tickets.service";

@ApiTags("Tickets")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "Unauthorized" })
@ApiForbiddenResponse({ description: "Forbidden - insufficient permissions" })
@Controller("events/:eventId/tickets")
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

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
