import { PrismaModule } from "src/prisma/prisma.module";

import { Module } from "@nestjs/common";

import { FormsController } from "./forms.controller";
import { FormsService } from "./forms.service";

@Module({
  controllers: [FormsController],
  providers: [FormsService],
  imports: [PrismaModule],
})
export class FormsModule {}
