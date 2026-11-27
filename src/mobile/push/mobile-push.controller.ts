import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import type { ParticipantContext } from "../auth/current-participant.decorator";
import { CurrentParticipant } from "../auth/current-participant.decorator";
import { ParticipantAuthGuard } from "../auth/participant-auth.guard";
import {
  MobilePushConfigDto,
  MobilePushSubscribeDto,
  MobilePushUnsubscribeDto,
} from "../dto/push.dto";
import { MobilePushService } from "./mobile-push.service";

@ApiTags("Mobile")
@ApiBearerAuth()
@ApiParam({ name: "eventSlug", description: "Slug of the event" })
@UseGuards(ParticipantAuthGuard)
@Controller("mobile/events/:eventSlug/push")
export class MobilePushController {
  constructor(private readonly pushService: MobilePushService) {}

  @Get()
  @ApiOperation({ summary: "Web Push configuration (VAPID public key)" })
  @ApiOkResponse({ type: MobilePushConfigDto })
  getConfig(): MobilePushConfigDto {
    return this.pushService.getConfig();
  }

  @Post("subscriptions")
  @HttpCode(204)
  @ApiOperation({
    summary: "Register this device's push subscription for the participant",
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: "Push is not configured on the server" })
  async subscribe(
    @CurrentParticipant() participant: ParticipantContext,
    @Body() dto: MobilePushSubscribeDto,
  ): Promise<void> {
    await this.pushService.subscribe(participant, dto);
  }

  @Delete("subscriptions")
  @HttpCode(204)
  @ApiOperation({ summary: "Remove this device's push subscription" })
  @ApiNoContentResponse()
  async unsubscribe(
    @CurrentParticipant() participant: ParticipantContext,
    @Body() dto: MobilePushUnsubscribeDto,
  ): Promise<void> {
    await this.pushService.unsubscribe(participant, dto.endpoint);
  }
}
