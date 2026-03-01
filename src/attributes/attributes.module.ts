import { Module } from "@nestjs/common";

import { AttributesController } from "./attributes.controller";
import { AttributesService } from "./attributes.service";

@Module({
  controllers: [AttributesController],
  providers: [AttributesService],
})
export class AttributesModule {}
