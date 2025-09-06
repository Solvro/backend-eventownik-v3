import { Module } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { ParticipantController } from "./participant.controller";
import { ParticipantService } from "./participant.service";

@Module({
  controllers: [ParticipantController],
  providers: [ParticipantService, PrismaService],
  exports: [ParticipantService],
})
export class ParticipantModule {}
