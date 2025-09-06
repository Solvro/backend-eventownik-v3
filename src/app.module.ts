import { Module } from "@nestjs/common";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ParticipantModule } from "./participant/participant.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [PrismaModule, ParticipantModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
