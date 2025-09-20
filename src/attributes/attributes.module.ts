import { Module } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { AttributesController } from "./attributes.controller";
import { AttributesService } from "./attributes.service";

@Module({
  controllers: [AttributesController],
  providers: [AttributesService, PrismaService],
  exports: [AttributesService],
})
export class AttributesModule {}
