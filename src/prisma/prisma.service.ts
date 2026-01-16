import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "src/generated/prisma/client";

import { Global, Injectable } from "@nestjs/common";

@Global()
@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    super({ adapter });
  }
}
