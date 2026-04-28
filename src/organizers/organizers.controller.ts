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

import { CreateOrganizerDto } from "./dto/create-organizer.dto";
import { OrganizerListingDto } from "./dto/organizer-listing.dto";
import { OrganizerResponseDto } from "./dto/organizer-response.dto";
import { UpdateOrganizerDto } from "./dto/update-organizer.dto";
import { OrganizersService } from "./organizers.service";

@ApiTags("Organizers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission(PermissionType.MANAGE_EVENT)
@ApiUnauthorizedResponse({ description: "Unauthorized" })
@ApiForbiddenResponse({ description: "Forbidden - insufficient permissions" })
@Controller("events/:eventId/organizers")
export class OrganizersController {
  constructor(private readonly organizersService: OrganizersService) {}

  @Post()
  @RequirePermission(PermissionType.MANAGE_SETTINGS)
  @ApiOperation({ summary: "Add an organizer to event" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiCreatedResponse({ description: "Organizer added successfully" })
  @ApiNotFoundResponse({ description: "admin, event or permission not found" })
  @ApiBadRequestResponse({
    description: "All permissionIds's elements must be unique",
  })
  async create(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body() createOrganizerDto: CreateOrganizerDto,
  ) {
    return await this.organizersService.create(eventId, createOrganizerDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all organizers for an event" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiPaginatedResponse(OrganizerResponseDto)
  @ApiNotFoundResponse({ description: "Event with this uuid was not found" })
  async findAll(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Query() query: OrganizerListingDto,
  ) {
    return this.organizersService.findAll(eventId, query);
  }

  @Get(":organizerId")
  @ApiOperation({ summary: "Get organizer by event id and organizer id" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "organizerId", description: "UUID of the organizer" })
  @ApiOkResponse({
    description: "Organizer retrieved successfully",
    type: OrganizerResponseDto,
  })
  @ApiNotFoundResponse({
    description:
      "organizer or event does not exist, or the organizer is not assigned to this event",
  })
  async findOne(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("organizerId", ParseUUIDPipe) organizerId: string,
  ) {
    return this.organizersService.findOne(eventId, organizerId);
  }

  @Patch(":organizerId")
  @RequirePermission(PermissionType.MANAGE_SETTINGS)
  @ApiOperation({ summary: "Update organizer permissions" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "organizerId", description: "UUID of the organizer" })
  @ApiOkResponse({
    description: "Organizer updated successfully",
    type: OrganizerResponseDto,
  })
  @ApiNotFoundResponse({ description: "admin, event or permission not found" })
  @ApiBadRequestResponse({
    description: "Duplicate permissions are not allowed",
  })
  async update(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("organizerId", ParseUUIDPipe) organizerId: string,
    @Body() updateOrganizerDto: UpdateOrganizerDto,
  ) {
    return await this.organizersService.update(
      eventId,
      organizerId,
      updateOrganizerDto,
    );
  }

  @Delete(":organizerId")
  @RequirePermission(PermissionType.MANAGE_SETTINGS)
  @HttpCode(204)
  @ApiOperation({ summary: "Delete organizer" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "organizerId", description: "UUID of the organizer" })
  @ApiNoContentResponse({ description: "Organizer deleted successfully" })
  @ApiNotFoundResponse({ description: "Admin or event not found" })
  @ApiForbiddenResponse({ description: "Cannot remove the last organizer" })
  async remove(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("organizerId", ParseUUIDPipe) organizerId: string,
  ) {
    return this.organizersService.remove(eventId, organizerId);
  }
}
