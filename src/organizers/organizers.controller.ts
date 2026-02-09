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
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { CreateOrganizerDto } from "./dto/create-organizer.dto";
import { OrganizerListingDto } from "./dto/organizer-listing.dto";
import { UpdateOrganizerDto } from "./dto/update-organizer.dto";
import { OrganizersService } from "./organizers.service";

@ApiTags("Organizers")
@Controller("events/:eventId/organizers")
export class OrganizersController {
  constructor(private readonly organizersService: OrganizersService) {}

  @Post()
  create(@Body() createOrganizerDto: CreateOrganizerDto) {
    return this.organizersService.create(createOrganizerDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all organizers for an event" })
  @ApiResponse({
    status: 200,
    description: "Organizers retrieved successfully",
    type: PageDto,
  })
  @ApiResponse({
    status: 404,
    description: "Event with this id was not found",
  })
  async findAll(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Query() query: OrganizerListingDto,
  ) {
    return this.organizersService.findAll(eventId, query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.organizersService.findOne(+id);
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
