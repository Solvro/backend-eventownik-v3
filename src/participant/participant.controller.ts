import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";

import { CreateParticipantDto } from "./dto/create-participant.dto";
import { QueryParticipantDto } from "./dto/query-participant.dto";
import { UpdateParticipantDto } from "./dto/update-participant.dto";
import { ParticipantService } from "./participant.service";

@Controller("api/v1")
@ApiTags("Participants")
export class ParticipantController {
  constructor(private readonly service: ParticipantService) {}

  @Get("internal/events/:eventUuid/participants")
  @ApiOperation({ summary: "Participants Endpoint" })
  @ApiResponse({ status: 200, description: "List of participants" })
  @ApiQuery({ type: QueryParticipantDto, required: false })
  async show(
    @Param("eventUuid") eventUuid: string,
    @Query() query: QueryParticipantDto,
  ) {
    return this.service.show(eventUuid, query);
  }

  @Get("internal/events/:eventUuid/participants/:uuid")
  @ApiOperation({ summary: "Show Participant Endpoint" })
  @ApiResponse({
    status: 200,
    description: "Show participant with provided UUID",
  })
  async index(
    @Param("eventUuid") eventUuid: string,
    @Param("uuid") uuid: string,
  ) {
    return this.service.index(eventUuid, uuid);
  }

  @Post("internal/events/:eventUuid/participants")
  @ApiOperation({ summary: "Create Participant Endpoint" })
  @ApiResponse({ status: 201, description: "Returns created participant" })
  async create(
    @Param("eventUuid") eventUuid: string,
    @Body() dto: CreateParticipantDto,
  ) {
    return this.service.create(eventUuid, dto);
  }

  @Put("internal/events/:eventUuid/participants/:uuid")
  @ApiOperation({ summary: "Update Participant Endpoint" })
  @ApiResponse({ status: 200, description: "Returns updated participant" })
  async update(
    @Param("eventUuid") eventUuid: string,
    @Param("uuid") uuid: string,
    @Body() dto: UpdateParticipantDto,
  ) {
    return this.service.update(eventUuid, uuid, dto);
  }

  @Delete("internal/events/:eventUuid/participants/:uuid")
  @ApiOperation({ summary: "Delete Participant Endpoint" })
  @ApiResponse({ status: 204, description: "No content" })
  @HttpCode(204)
  async remove(
    @Param("eventUuid") eventUuid: string,
    @Param("uuid") uuid: string,
  ): Promise<void> {
    await this.service.remove(eventUuid, uuid);
  }
}
