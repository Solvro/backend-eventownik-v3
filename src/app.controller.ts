import { Controller, Get, UseGuards } from "@nestjs/common";

import { AppService } from "./app.service";
import { PrismaService } from "./prisma/prisma.service";
import { TokenV2Guard } from "./token-v2/token-v2.guard";

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @UseGuards(TokenV2Guard)
  getHello(): string {
    return this.appService.getHello();
  }
}
