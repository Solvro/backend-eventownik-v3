import { Module } from "@nestjs/common";

import { OrganizersController } from "./organizers.controller";
import { OrganizersService } from "./organizers.service";

@Module({
  controllers: [OrganizersController],
  providers: [OrganizersService],
})
export class OrganizersModule {}
