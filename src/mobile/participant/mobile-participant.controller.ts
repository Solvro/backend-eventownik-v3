import { memoryStorage } from "multer";

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import type { ParticipantContext } from "../auth/current-participant.decorator";
import { CurrentParticipant } from "../auth/current-participant.decorator";
import { ParticipantAuthGuard } from "../auth/participant-auth.guard";
import { MOBILE_IMAGE_MAX_BYTES } from "../common/mobile-image.service";
import { MobileNotificationsQueryDto } from "../dto/notifications-query.dto";
import { MobileProfileDto } from "../dto/profile.dto";
import { MobileParticipantService } from "./mobile-participant.service";

@ApiTags("Mobile")
@ApiBearerAuth()
@ApiParam({ name: "eventSlug", description: "Slug of the event" })
@UseGuards(ParticipantAuthGuard)
@Controller("mobile/events/:eventSlug")
export class MobileParticipantController {
  constructor(private readonly participantService: MobileParticipantService) {}

  @Get("me")
  @ApiOperation({ summary: "Current participant and their profile" })
  @ApiOkResponse()
  async getMe(@CurrentParticipant() participant: ParticipantContext) {
    return this.participantService.getMe(participant);
  }

  @Put("me/profile")
  @ApiOperation({ summary: "Create or update the participant's profile" })
  @ApiOkResponse()
  async updateProfile(
    @CurrentParticipant() participant: ParticipantContext,
    @Body() dto: MobileProfileDto,
  ) {
    return this.participantService.updateProfile(participant, dto);
  }

  @Post("me/photo")
  @HttpCode(200)
  @ApiOperation({
    summary: "Upload the profile photo (JPEG/PNG/WebP, max 8 MB)",
  })
  @ApiOkResponse()
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: { photo: { type: "string", format: "binary" } },
      required: ["photo"],
    },
  })
  @UseInterceptors(
    FileInterceptor("photo", {
      storage: memoryStorage(),
      limits: { fileSize: MOBILE_IMAGE_MAX_BYTES, files: 1 },
    }),
  )
  async updatePhoto(
    @CurrentParticipant() participant: ParticipantContext,
    @UploadedFile() photo: Express.Multer.File | undefined,
  ) {
    return this.participantService.updatePhoto(participant, photo);
  }

  @Get("notifications")
  @ApiOperation({ summary: "Event notifications, newest first (max 100)" })
  @ApiOkResponse()
  async getNotifications(
    @CurrentParticipant() participant: ParticipantContext,
    @Query() query: MobileNotificationsQueryDto,
  ) {
    return this.participantService.getNotifications(
      participant.eventUuid,
      query.afterSeq,
    );
  }

  @Get("schedule")
  @ApiOperation({ summary: "Event schedule, ascending by start" })
  @ApiOkResponse()
  async getSchedule(@CurrentParticipant() participant: ParticipantContext) {
    return this.participantService.getSchedule(participant.eventUuid);
  }

  @Get("sos")
  @ApiOperation({ summary: "SOS contacts and FAQ" })
  @ApiOkResponse()
  async getSos(@CurrentParticipant() participant: ParticipantContext) {
    return this.participantService.getSos(participant.eventUuid);
  }
}
