import { PageDto } from "src/common/dto/page.dto";

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from "@nestjs/swagger";

import { CreateOrganizerDto } from "./dto/create-organizer.dto";
import { OrganizerListingDto } from "./dto/organizer-listing.dto";
import { OrganizerResponseDto } from "./dto/organizer-response.dto";
import { UpdateOrganizerDto } from "./dto/update-organizer.dto";
import { OrganizersService } from "./organizers.service";

@ApiTags("Organizers")
@Controller("events/:eventId/organizers")
export class OrganizersController {
  constructor(private readonly organizersService: OrganizersService) {}

  @Post()
  @ApiOperation({ summary: "Add an organizer to event" })
  @ApiResponse({
    status: 201,
    description: "Organizer added successfully",
  })
  @ApiResponse({
    status: 404,
    description: "admin, event or permission not found",
  })
  async create(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body() createOrganizerDto: CreateOrganizerDto,
  ) {
    return await this.organizersService.create(eventId, createOrganizerDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all organizers for an event" })
  @ApiResponse({
    status: 200,
    description: "Organizers retrieved successfully",
    schema: {
      allOf: [
        { $ref: getSchemaPath(PageDto) },
        {
          properties: {
            data: {
              type: "array",
              items: { $ref: getSchemaPath(OrganizerResponseDto) },
            },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 404,
    description: "Event with this uuid was not found",
  })
  async findAll(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Query() query: OrganizerListingDto,
  ) {
    return this.organizersService.findAll(eventId, query);
  }

  @Get(":organizerId")
  @ApiOperation({ summary: "Get organizer by event id and organizer id" })
  @ApiResponse({
    status: 200,
    description: "Organizer retrieved successfully",
    type: OrganizerResponseDto,
  })
  @ApiResponse({
    status: 404,
    description:
      "organizer or event does not exist, or the organizer isnt assigned to this event",
  })
  async findOne(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("organizerId", ParseUUIDPipe) organizerId: string,
  ) {
    return this.organizersService.findOne(eventId, organizerId);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() updateOrganizerDto: UpdateOrganizerDto,
  ) {
    return this.organizersService.update(+id, updateOrganizerDto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.organizersService.remove(+id);
  }
}
