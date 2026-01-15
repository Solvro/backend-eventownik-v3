import { Admin } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import { Injectable } from "@nestjs/common";

@Injectable()
export class AdminsService {
  constructor(private prisma: PrismaService) {}

  async getAdminByUuid(uuid: string): Promise<Admin> {
    return await this.prisma.admin.findFirstOrThrow({ where: { uuid } });
  }
}
