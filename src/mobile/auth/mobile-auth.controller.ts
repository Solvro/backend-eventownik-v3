import { Body, Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import { MobileEventService } from "../common/mobile-event.service";
import { MobileImageService } from "../common/mobile-image.service";
import { MobileOtpRequestDto, MobileOtpVerifyDto } from "../dto/otp.dto";
import { MobileAuthService } from "./mobile-auth.service";

@ApiTags("Mobile")
@ApiParam({ name: "eventSlug", description: "Slug of the event" })
@Controller("mobile/events/:eventSlug")
export class MobileAuthController {
  constructor(
    private readonly authService: MobileAuthService,
    private readonly mobileEventService: MobileEventService,
    private readonly imageService: MobileImageService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Public mobile app config (404 when not enabled)" })
  @ApiOkResponse()
  async getPublicConfig(@Param("eventSlug") eventSlug: string) {
    const { event, app } =
      await this.mobileEventService.getEnabledBySlug(eventSlug);
    return {
      event: {
        uuid: event.uuid,
        name: event.name,
        slug: event.slug,
        primaryColor: event.primaryColor,
        photoUrl: this.imageService.url(event.photoKey),
        startDate: event.startDate.toISOString(),
        endDate: event.endDate.toISOString(),
        location: event.location,
        organizerName: event.organizerName,
      },
      app: {
        welcomeMessage: app.welcomeMessage,
        accentColor: app.accentColor,
        features: {
          sos: app.sosEnabled,
          schedule: app.scheduleEnabled,
          chat: app.chatEnabled,
          tinder: app.tinderEnabled,
          bingo: app.bingoEnabled,
          bereal: app.berealEnabled,
          soundboard: app.soundboardEnabled,
        },
      },
    };
  }

  @Post("auth/otp/request")
  @HttpCode(200)
  @ApiOperation({ summary: "Send a login code to the participant's email" })
  @ApiOkResponse()
  async requestOtp(
    @Param("eventSlug") eventSlug: string,
    @Body() dto: MobileOtpRequestDto,
  ): Promise<{ ok: true }> {
    return this.authService.requestOtp(eventSlug, dto.email);
  }

  @Post("auth/otp/verify")
  @HttpCode(200)
  @ApiOperation({ summary: "Exchange a login code for a participant token" })
  @ApiOkResponse()
  async verifyOtp(
    @Param("eventSlug") eventSlug: string,
    @Body() dto: MobileOtpVerifyDto,
  ) {
    return this.authService.verifyOtp(eventSlug, dto.email, dto.code);
  }
}
