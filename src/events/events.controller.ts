import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { AuthUser } from "src/auth/jwt.strategy";
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
  Request,
  UploadedFile,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { EventCreateDto } from "./dto/event-create.dto";
import { EventListingDto } from "./dto/event-listing.dto";
import { EventUpdateDto } from "./dto/event-update.dto";
import { Event } from "./entities/event.entity";
import { EventsService } from "./events.service";
import { UploadPhoto } from "./utils/upload-photo.decorator";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "Unauthorized" })
@ApiForbiddenResponse({ description: "Forbidden - insufficient permissions" })
@ApiTags("Events")
@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({ summary: "Get list of events with pagination and filtering" })
  @ApiPaginatedResponse(Event)
  async findAll(
    @Query() dto: EventListingDto,
    @Request() request: { user: AuthUser },
  ): Promise<PageDto<Event>> {
    // z auth'em, zwracać swoje eventy / wszystkie dla superadmina
    const eventsIds = request.user.permissions.map((p) => p.eventId);
    return this.eventsService.findAll(dto, eventsIds, request.user.type);
  }

  @Post()
  @UploadPhoto(EventCreateDto)
  @ApiOperation({ summary: "Create a new event" })
  @ApiCreatedResponse({ description: "The created event", type: Event })
  async create(
    @UploadedFile() photo: Express.Multer.File | undefined,
    @Body() eventDto: EventCreateDto,
    @Request() request: { user: AuthUser },
  ): Promise<Event> {
    return this.eventsService.create(
      eventDto,
      photo,
      request.user.uuid,
      request.user.type,
    );
  }

  @Get(":eventId")
  @RequirePermission(PermissionType.MANAGE_EVENT)
  @ApiOperation({ summary: "Get event by UUID" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiOkResponse({ description: "The event", type: Event })
  async findOne(
    @Param("eventId", ParseUUIDPipe) eventUUID: string,
  ): Promise<Event> {
    return this.eventsService.findOne(eventUUID);
  }

  @Patch(":eventId")
  @RequirePermission(PermissionType.MANAGE_EVENT)
  @UploadPhoto(EventUpdateDto)
  @ApiOperation({
    summary: "Update event by UUID",
    description:
      "Accepts multipart/form-data with an optional 'photo' file. To remove the current photo, send a JSON body with photoUrl set to null.",
  })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiOkResponse({ description: "The updated event", type: Event })
  async update(
    @Param("eventId", ParseUUIDPipe) eventUUID: string,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @Body() eventDto: EventUpdateDto,
    @Request() request: { user: AuthUser },
  ): Promise<Event> {
    return this.eventsService.update(
      eventUUID,
      eventDto,
      photo,
      request.user.type,
    );
  }

  @Delete(":eventId")
  // TODO: jakaś inna permisja jak będą współorganizatorzy
  @RequirePermission(PermissionType.MANAGE_EVENT)
  @ApiOperation({ summary: "Delete event by UUID" })
  @ApiParam({ name: "eventId", description: "UUID of the event" })
  @ApiNoContentResponse({ description: "No content" })
  @HttpCode(204)
  async remove(
    @Param("eventId", ParseUUIDPipe) eventUUID: string,
  ): Promise<void> {
    await this.eventsService.remove(eventUUID);
  }
}
