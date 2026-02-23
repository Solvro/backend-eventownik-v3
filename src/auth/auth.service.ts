import { Admin } from "src/generated/prisma/client";

import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<Admin | null> {
    const user = await this.prisma.admin.findUnique({ where: { email } });
    if (user?.password === pass) {
      const { password, ...result } = user;
      return user;
    }
    return null;
  }

  async login(user: Admin) {
    const payload = { email: user.email, sub: user.uuid };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
