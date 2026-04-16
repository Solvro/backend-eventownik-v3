import { BlocksModule } from "src/blocks/blocks.module";
import { ParticipantsModule } from "src/participants/participants.module";

import { Module } from "@nestjs/common";

import { FormsController } from "./forms.controller";
import { FormsService } from "./forms.service";

@Module({
  controllers: [FormsController],
  providers: [FormsService],
  imports: [ParticipantsModule, BlocksModule],
  exports: [FormsService],
})
export class FormsModule {}
