import { Module } from "@nestjs/common";

import { MobilePushService } from "./mobile-push.service";

@Module({
  providers: [MobilePushService],
  exports: [MobilePushService],
})
export class MobilePushModule {}
