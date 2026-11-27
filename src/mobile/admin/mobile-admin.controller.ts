import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import type { AuthUser } from "src/auth/jwt.strategy";
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
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import {
  CreateMobileFaqItemDto,
  CreateMobileNotificationDto,
  CreateMobileScheduleItemDto,
  CreateMobileSosContactDto,
  MobileAppConfigDto,
  UpdateMobileFaqItemDto,
  UpdateMobileScheduleItemDto,
  UpdateMobileSosContactDto,
} from "../dto/admin.dto";
import { MobileAdminService } from "./mobile-admin.service";

@ApiTags("Mobile")
@ApiBearerAuth()
@ApiParam({ name: "eventId", description: "UUID of the event" })
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission([
  PermissionType.MANAGE_SETTINGS,
  PermissionType.MANAGE_EVENT,
])
@Controller("events/:eventId/mobile")
export class MobileAdminController {
  constructor(private readonly adminService: MobileAdminService) {}

  @Get()
  @ApiOperation({ summary: "Mobile app config of the event" })
  @ApiOkResponse()
  async getConfig(@Param("eventId", ParseUUIDPipe) eventId: string) {
    return this.adminService.getConfig(eventId);
  }

  @Put()
  @ApiOperation({ summary: "Update the mobile app config (partial body)" })
  @ApiOkResponse()
  async updateConfig(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body() dto: MobileAppConfigDto,
  ) {
    return this.adminService.updateConfig(eventId, dto);
  }

  // SOS contacts -------------------------------------------------------------

  @Get("sos-contacts")
  @ApiOperation({ summary: "List SOS contacts" })
  @ApiOkResponse()
  async listSosContacts(@Param("eventId", ParseUUIDPipe) eventId: string) {
    return this.adminService.listSosContacts(eventId);
  }

  @Post("sos-contacts")
  @ApiOperation({ summary: "Create an SOS contact" })
  @ApiCreatedResponse()
  async createSosContact(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body() dto: CreateMobileSosContactDto,
  ) {
    return this.adminService.createSosContact(eventId, dto);
  }

  @Patch("sos-contacts/:uuid")
  @ApiOperation({ summary: "Update an SOS contact" })
  @ApiOkResponse()
  async updateSosContact(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("uuid", ParseUUIDPipe) uuid: string,
    @Body() dto: UpdateMobileSosContactDto,
  ) {
    return this.adminService.updateSosContact(eventId, uuid, dto);
  }

  @Delete("sos-contacts/:uuid")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete an SOS contact" })
  @ApiNoContentResponse()
  async deleteSosContact(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("uuid", ParseUUIDPipe) uuid: string,
  ): Promise<void> {
    await this.adminService.deleteSosContact(eventId, uuid);
  }

  // FAQ ----------------------------------------------------------------------

  @Get("faq")
  @ApiOperation({ summary: "List FAQ items" })
  @ApiOkResponse()
  async listFaq(@Param("eventId", ParseUUIDPipe) eventId: string) {
    return this.adminService.listFaq(eventId);
  }

  @Post("faq")
  @ApiOperation({ summary: "Create an FAQ item" })
  @ApiCreatedResponse()
  async createFaq(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body() dto: CreateMobileFaqItemDto,
  ) {
    return this.adminService.createFaq(eventId, dto);
  }

  @Patch("faq/:uuid")
  @ApiOperation({ summary: "Update an FAQ item" })
  @ApiOkResponse()
  async updateFaq(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("uuid", ParseUUIDPipe) uuid: string,
    @Body() dto: UpdateMobileFaqItemDto,
  ) {
    return this.adminService.updateFaq(eventId, uuid, dto);
  }

  @Delete("faq/:uuid")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete an FAQ item" })
  @ApiNoContentResponse()
  async deleteFaq(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("uuid", ParseUUIDPipe) uuid: string,
  ): Promise<void> {
    await this.adminService.deleteFaq(eventId, uuid);
  }

  // Schedule -----------------------------------------------------------------

  @Get("schedule")
  @ApiOperation({ summary: "List schedule items" })
  @ApiOkResponse()
  async listSchedule(@Param("eventId", ParseUUIDPipe) eventId: string) {
    return this.adminService.listSchedule(eventId);
  }

  @Post("schedule")
  @ApiOperation({ summary: "Create a schedule item" })
  @ApiCreatedResponse()
  async createSchedule(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body() dto: CreateMobileScheduleItemDto,
  ) {
    return this.adminService.createSchedule(eventId, dto);
  }

  @Patch("schedule/:uuid")
  @ApiOperation({ summary: "Update a schedule item" })
  @ApiOkResponse()
  async updateSchedule(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("uuid", ParseUUIDPipe) uuid: string,
    @Body() dto: UpdateMobileScheduleItemDto,
  ) {
    return this.adminService.updateSchedule(eventId, uuid, dto);
  }

  @Delete("schedule/:uuid")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete a schedule item" })
  @ApiNoContentResponse()
  async deleteSchedule(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("uuid", ParseUUIDPipe) uuid: string,
  ): Promise<void> {
    await this.adminService.deleteSchedule(eventId, uuid);
  }

  // Notifications ------------------------------------------------------------

  @Get("notifications")
  @ApiOperation({ summary: "List notifications, newest first" })
  @ApiOkResponse()
  async listNotifications(@Param("eventId", ParseUUIDPipe) eventId: string) {
    return this.adminService.listNotifications(eventId);
  }

  @Post("notifications")
  @ApiOperation({ summary: "Send a notification to participants" })
  @ApiCreatedResponse()
  async createNotification(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Req() request: { user: AuthUser },
    @Body() dto: CreateMobileNotificationDto,
  ) {
    return this.adminService.createNotification(
      eventId,
      request.user.uuid,
      dto,
    );
  }

  @Delete("notifications/:uuid")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete a notification" })
  @ApiNoContentResponse()
  async deleteNotification(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("uuid", ParseUUIDPipe) uuid: string,
  ): Promise<void> {
    await this.adminService.deleteNotification(eventId, uuid);
  }
}
