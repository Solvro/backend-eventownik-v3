import { Module } from "@nestjs/common";

import { MobileCoreModule } from "../mobile-core.module";
import { MobileBerealService } from "./mobile-bereal.service";
import { MobileBingoService } from "./mobile-bingo.service";
import { MobileChatService } from "./mobile-chat.service";
import { MobileGifService } from "./mobile-gif.service";
import { MobileSocialAdminController } from "./mobile-social-admin.controller";
import { MobileSocialController } from "./mobile-social.controller";
import { MobileTinderService } from "./mobile-tinder.service";

@Module({
  imports: [MobileCoreModule],
  controllers: [MobileSocialController, MobileSocialAdminController],
  providers: [
    MobileChatService,
    MobileGifService,
    MobileTinderService,
    MobileBingoService,
    MobileBerealService,
  ],
})
export class MobileSocialModule {}
