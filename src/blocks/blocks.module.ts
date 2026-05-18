import { ParticipantsModule } from "src/participants/participants.module";

import { Module } from "@nestjs/common";

import { BlocksPublicController } from "./block-public.controller";
import { BlocksController } from "./blocks.controller";
import { BlocksService } from "./blocks.service";

@Module({
  controllers: [BlocksController, BlocksPublicController],
  providers: [BlocksService],
  exports: [BlocksService],
  imports: [ParticipantsModule],
})
export class BlocksModule {}
