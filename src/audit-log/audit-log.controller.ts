import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { RequirePermission } from "src/auth/permissions.decorator";
import { PermissionsGuard } from "src/auth/permissions.guard";
import { ApiPaginatedResponse } from "src/common/decorators/api-paginated-response.decorator";
import { PermissionType } from "src/generated/prisma/enums";

import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { AuditLogQueryService } from "./audit-log-query.service";
import { AuditLogListingDto } from "./dto/audit-log-listing.dto";
import { AuditLogResponseDto } from "./dto/audit-log-response.dto";

@ApiTags("Audit log")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission(PermissionType.MANAGE_ALL)
@ApiUnauthorizedResponse({ description: "Unauthorized" })
@ApiForbiddenResponse({ description: "Forbidden - insufficient permissions" })
@Controller("events/:eventId/audit-logs")
export class AuditLogController {
  constructor(private readonly auditLogQueryService: AuditLogQueryService) {}

  @Get()
  @ApiOperation({
    summary: "List the audit log of an event",
    description:
      "Returns every recorded change made by admins and participants within the event, newest first. Requires MANAGE_ALL permission.",
  })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiPaginatedResponse(AuditLogResponseDto)
  @ApiNotFoundResponse({ description: "Event with this uuid was not found" })
  async findAll(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Query() query: AuditLogListingDto,
  ) {
    return this.auditLogQueryService.findAll(eventId, query);
  }
}
