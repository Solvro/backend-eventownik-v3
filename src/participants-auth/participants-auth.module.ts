import { PrismaModule } from "src/prisma/prisma.module";

import { Module } from "@nestjs/common";

import { ParticipantsAuthController } from "./participants-auth.controller";
import { ParticipantsAuthService } from "./participants-auth.service";

@Module({
  imports: [PrismaModule],
  controllers: [ParticipantsAuthController],
  providers: [ParticipantsAuthService],
})
export class ParticipantsAuthModule {}
