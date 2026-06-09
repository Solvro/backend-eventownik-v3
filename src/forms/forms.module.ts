import { HcaptchaModule } from "@gvrs/nestjs-hcaptcha";
import { BlocksModule } from "src/blocks/blocks.module";
import { ParticipantsModule } from "src/participants/participants.module";

import { Module } from "@nestjs/common";

import { FormsPublicController } from "./forms-public.controller";
import { FormsController } from "./forms.controller";
import { FormsService } from "./forms.service";

@Module({
  controllers: [FormsController, FormsPublicController],
  providers: [FormsService],
  imports: [ParticipantsModule, BlocksModule, HcaptchaModule],
  exports: [FormsService],
})
export class FormsModule {}
