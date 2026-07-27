import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { RequirePermission } from "src/auth/permissions.decorator";
import { PermissionsGuard } from "src/auth/permissions.guard";
import { ApiPaginatedResponse } from "src/common/decorators/api-paginated-response.decorator";
import { PageOptionsDto } from "src/common/dto/page-options.dto";
import { PermissionType } from "src/generated/prisma/enums";

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiAcceptedResponse,
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

import { CreateEmailDto } from "./dto/create-email.dto";
import { DuplicateEmailDto } from "./dto/duplicate-email.dto";
import { EmailCompleteElementDto } from "./dto/email-complete-element.dto";
import { EmailListElementDto } from "./dto/email-list-element.dto";
import { EmailListingDto } from "./dto/email-listing.dto";
import { EmailResponseDto } from "./dto/email-response.dto";
import { SendEmailDto } from "./dto/send-email.dto";
import { SendTestEmailDto } from "./dto/send-test-email.dto";
import { UpdateEmailDto } from "./dto/update-email.dto";
import { EmailDeliveryService } from "./email-delivery.service";
import { EmailTemplatesService } from "./email-templates.service";

@ApiTags("EmailTemplates")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiUnauthorizedResponse({ description: "Unauthorized" })
@ApiForbiddenResponse({ description: "Forbidden - insufficient permissions" })
@Controller("events/:eventId/emails")
export class EmailsController {
  constructor(
    private readonly emailTemplatesService: EmailTemplatesService,
    private readonly emailDeliveryService: EmailDeliveryService,
  ) {}

  @Post()
  @RequirePermission(PermissionType.MANAGE_EMAIL)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Add an email template to event" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiCreatedResponse({
    description: "Email template added sucessfully",
    type: EmailResponseDto,
  })
  @ApiBadRequestResponse({ description: "Event or Form not found." })
  async create(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body() query: CreateEmailDto,
  ) {
    return this.emailTemplatesService.create(eventId, query);
  }

  @Get()
  @RequirePermission(PermissionType.MANAGE_EMAIL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get all email templates for an event" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiPaginatedResponse(EmailListElementDto)
  @ApiBadRequestResponse({ description: "Event with this UUID not found" })
  async findAll(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Query() query: EmailListingDto,
  ) {
    return this.emailTemplatesService.findAll(eventId, query);
  }

  @Get(":emailId")
  @RequirePermission(PermissionType.MANAGE_EMAIL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get an email template by event id and email id" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "emailId", description: "UUID of the email" })
  @ApiOkResponse({
    description: "Email template retrieved successfully",
    type: EmailCompleteElementDto,
  })
  @ApiNotFoundResponse({ description: "Event or email does not exist" })
  async findOne(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("emailId", ParseUUIDPipe) emailId: string,
  ) {
    return this.emailTemplatesService.findOne(eventId, emailId);
  }

  @Get(":emailId/participants")
  @RequirePermission(PermissionType.MANAGE_EMAIL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Get paginated participant delivery statuses for an email",
  })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "emailId", description: "UUID of the email" })
  @ApiOkResponse({ description: "Paginated participants list" })
  async findParticipants(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("emailId", ParseUUIDPipe) emailId: string,
    @Query() query: PageOptionsDto,
  ) {
    return this.emailDeliveryService.findParticipantsForEmail(
      eventId,
      emailId,
      query,
    );
  }

  @Post(":emailId/duplicate")
  @RequirePermission(PermissionType.MANAGE_EMAIL)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Duplicate an email template" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "emailId", description: "UUID of the email to duplicate" })
  @ApiCreatedResponse({
    description: "Email template duplicated successfully",
    type: EmailResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Email template or event does not exist",
  })
  async duplicate(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("emailId", ParseUUIDPipe) emailId: string,
    @Body() query: DuplicateEmailDto,
  ) {
    return this.emailsService.duplicate(eventId, emailId, query);
  }

  @Post(":emailId/duplicate")
  @RequirePermission(PermissionType.MANAGE_EMAIL)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Duplicate an email template" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "emailId", description: "UUID of the email to duplicate" })
  @ApiCreatedResponse({
    description: "Email template duplicated successfully",
    type: EmailResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Email template or event does not exist",
  })
  async duplicate(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("emailId", ParseUUIDPipe) emailId: string,
    @Body() query: DuplicateEmailDto,
  ) {
    return this.emailsService.duplicate(eventId, emailId, query);
  }

  @Patch(":emailId")
  @RequirePermission(PermissionType.MANAGE_EMAIL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update email template" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "emailId", description: "UUID of the email" })
  @ApiOkResponse({
    description: "Email template updated successfully",
    type: EmailResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Email template or event does not exist",
  })
  async update(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("emailId", ParseUUIDPipe) emailId: string,
    @Body() query: UpdateEmailDto,
  ) {
    return this.emailTemplatesService.update(eventId, emailId, query);
  }

  @Delete(":emailId")
  @RequirePermission(PermissionType.MANAGE_EMAIL)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete email template" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "emailId", description: "UUID of the email" })
  @ApiNoContentResponse({ description: "Email template deleted successfully" })
  @ApiNotFoundResponse({
    description: "Email template or event does not exist",
  })
  async remove(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("emailId", ParseUUIDPipe) emailId: string,
  ) {
    return this.emailTemplatesService.remove(eventId, emailId);
  }

  @Post(":emailId/send")
  @RequirePermission(PermissionType.MANAGE_EMAIL)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: "Manually queue this email template for a set of participants",
  })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "emailId", description: "UUID of the email" })
  @ApiAcceptedResponse({
    description: "Email queued for the given participants",
  })
  @ApiNotFoundResponse({ description: "Email template not found" })
  @ApiBadRequestResponse({
    description: "One or more participants were not found in this event",
  })
  async send(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("emailId", ParseUUIDPipe) emailId: string,
    @Body() query: SendEmailDto,
  ) {
    return this.emailDeliveryService.sendManualEmail(
      eventId,
      emailId,
      query.participantUuids,
    );
  }

  @Post(":emailId/test-send")
  @RequirePermission(PermissionType.MANAGE_EMAIL)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      "Send a test rendering of this email template to an arbitrary address",
  })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiParam({ name: "emailId", description: "UUID of the email" })
  @ApiNoContentResponse({ description: "Test email sent" })
  @ApiNotFoundResponse({ description: "Email template not found" })
  @ApiBadRequestResponse({ description: "Participant not found in this event" })
  async testSend(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("emailId", ParseUUIDPipe) emailId: string,
    @Body() query: SendTestEmailDto,
  ) {
    return this.emailDeliveryService.sendTestEmail(
      eventId,
      emailId,
      query.email,
      query.participantUuid,
    );
  }
}
