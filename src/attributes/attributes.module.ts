import { BlocksModule } from "src/blocks/blocks.module";

import { Module } from "@nestjs/common";

import { AttributesController } from "./attributes.controller";
import { AttributesService } from "./attributes.service";

@Module({
  imports: [BlocksModule],
  controllers: [AttributesController],
  providers: [AttributesService],
})
export class AttributesModule {}
