import * as bcrypt from "bcrypt";
import { Admin } from "src/generated/prisma/client";

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<Admin> {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    return this.prisma.admin.create({
      data: {
        ...data,
        password: hashedPassword,
      },
    });
  }

  async validateUser(email: string, pass: string): Promise<Admin | null> {
    const user = await this.prisma.admin.findUnique({ where: { email } });
    if (user !== null && (await bcrypt.compare(pass, user.password))) {
      return user;
    }
    return null;
  }

  async login(user: Admin) {
    const payload = { email: user.email, sub: user.uuid };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.generateRefreshToken(user.uuid);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  private async generateRefreshToken(adminUuid: string): Promise<string> {
    const refreshToken = await bcrypt.hash(Math.random().toString(36), 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.authAccessToken.create({
      data: {
        tokenableId: adminUuid,
        type: "refresh_token",
        token: refreshToken,
        abilities: "*",
        updatedAt: new Date(),
        expiresAt,
      },
    });

    return refreshToken;
  }

  async refreshTokens(token: string) {
    const storedToken = await this.prisma.authAccessToken.findUnique({
      where: { token },
      include: { admin: true },
    });

    if (storedToken === null || storedToken.expiresAt < new Date()) {
      if (storedToken !== null) {
        await this.prisma.authAccessToken.delete({
          where: { id: storedToken.id },
        });
      }
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    // Rotate token
    await this.prisma.authAccessToken.delete({ where: { id: storedToken.id } });
    return this.login(storedToken.admin);
  }
}
