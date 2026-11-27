import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { MobileAdminController } from "./admin/mobile-admin.controller";
import { MobileAdminService } from "./admin/mobile-admin.service";
import { MobileAuthController } from "./auth/mobile-auth.controller";
import { MobileAuthService } from "./auth/mobile-auth.service";
import { MOBILE_OTP_EMAIL_QUEUE_NAME } from "./auth/mobile-otp-email.constants";
import { MobileOtpEmailConsumer } from "./auth/mobile-otp-email.consumer";
import { MobileOtpEmailService } from "./auth/mobile-otp-email.service";
import { MobileTokenService } from "./auth/mobile-token.service";
import { ParticipantAuthGuard } from "./auth/participant-auth.guard";
import { MobileEventService } from "./common/mobile-event.service";
import { MobileImageService } from "./common/mobile-image.service";
import { MobileParticipantController } from "./participant/mobile-participant.controller";
import { MobileParticipantService } from "./participant/mobile-participant.service";

@Module({
  imports: [
    JwtModule.register({}),
    BullModule.registerQueue({
      name: MOBILE_OTP_EMAIL_QUEUE_NAME,
      defaultJobOptions: {
        attempts: 3,
        backoff: { delay: 1000, type: "exponential" },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    }),
  ],
  controllers: [
    MobileAuthController,
    MobileParticipantController,
    MobileAdminController,
  ],
  providers: [
    MobileTokenService,
    MobileEventService,
    MobileImageService,
    ParticipantAuthGuard,
    MobileAuthService,
    MobileOtpEmailService,
    MobileOtpEmailConsumer,
    MobileParticipantService,
    MobileAdminService,
  ],
  exports: [
    MobileTokenService,
    MobileEventService,
    MobileImageService,
    ParticipantAuthGuard,
  ],
})
export class MobileCoreModule {}
