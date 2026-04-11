import { PrismaModule } from "src/prisma/prisma.module";

import { Module } from "@nestjs/common";

import { ParticipantsAttributesController } from "./participants-attributes.controller";
import { ParticipantsController } from "./participants.controller";
import { ParticipantsService } from "./participants.service";
import { PublicParticipantsController } from "./public-participants.controller";

@Module({
  imports: [PrismaModule],
  controllers: [
    ParticipantsController,
    ParticipantsAttributesController,
    PublicParticipantsController,
  ],
  providers: [ParticipantsService],
  exports: [ParticipantsService],
})
export class ParticipantsModule {}
