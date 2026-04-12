import { ParticipantsModule } from "src/participants/participants.module";

import { Module } from "@nestjs/common";

import { FormsController } from "./forms.controller";
import { FormsService } from "./forms.service";

@Module({
  controllers: [FormsController],
  providers: [FormsService],
  imports: [ParticipantsModule],
})
export class FormsModule {}
