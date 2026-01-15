/* eslint-disable @darraghor/nestjs-typed/api-method-should-specify-api-operation */
/* eslint-disable @darraghor/nestjs-typed/api-method-should-specify-api-response */
/* eslint-disable @darraghor/nestjs-typed/controllers-should-supply-api-tags */
import { Controller, Get, Param } from "@nestjs/common";

import { AdminsService } from "./admins.service";

@Controller("admins")
export class AdminsController {
  constructor(private adminsService: AdminsService) {}

  @Get(":uuid")
  async getAdmin(@Param("uuid") uuid: string) {
    return await this.adminsService.getAdminByUuid(uuid);
  }
}
