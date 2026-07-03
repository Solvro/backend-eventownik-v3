import * as bcrypt from "bcrypt";
import { createHash, randomBytes } from "node:crypto";
import { Admin } from "src/generated/prisma/client";

import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<Omit<Admin, "password">> {
    const hashedPassword = await bcrypt.hash(data.password, 12);
    try {
      const user = await this.prisma.admin.create({
        data: {
          ...data,
          password: hashedPassword,
        },
      });

      const { password, ...result } = user;
      return result;
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        throw new ConflictException("Email already in use");
      }
      throw error;
    }
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
    const refreshToken = randomBytes(64).toString("hex");
    const hashedToken = createHash("sha256").update(refreshToken).digest("hex");
    const ttlDays = this.configService.getOrThrow<number>(
      "REFRESH_TOKEN_TTL_DAYS",
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ttlDays); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        adminUuid,
        token: hashedToken,
        expiresAt,
      },
    });

    return refreshToken;
  }

  async refreshTokens(token: string) {
    const hashedToken = createHash("sha256").update(token).digest("hex");
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: hashedToken },
      include: { admin: true },
    });

    if (storedToken === null) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (storedToken.expiresAt < new Date()) {
      await this.prisma.refreshToken.deleteMany({
        where: { uuid: storedToken.uuid },
      });
      throw new UnauthorizedException("Expired refresh token");
    }

    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { uuid: storedToken.uuid },
    });

    if (count === 0) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    return this.login(storedToken.admin);
  }

  async forgotPassword(email: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { email },
    });
    if (admin !== null) {
      const resetToken = randomBytes(64).toString("hex");
      const hashedToken = createHash("sha256").update(resetToken).digest("hex");
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      await this.prisma.passwordResetToken.create({
        data: {
          adminUuid: admin.uuid,
          expiresAt,
          token: hashedToken,
        },
      });
      // !!! TODO: ADD EMAIL SENDING !!!
    }
  }

  async resetPassword(token: string, password: string) {
    const hashedToken = createHash("sha256").update(token).digest("hex");
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: hashedToken },
    });

    if (resetToken === null || resetToken.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Invalid or expired token");
    }
    const hashedPassword = await bcrypt.hash(password, 12);

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.passwordResetToken.deleteMany({
        where: { uuid: resetToken.uuid },
      });

      if (count === 0) {
        throw new BadRequestException("Invalid or expired token");
      }

      await tx.admin.update({
        where: { uuid: resetToken.adminUuid },
        data: { password: hashedPassword },
      });

      await tx.refreshToken.deleteMany({
        where: { adminUuid: resetToken.adminUuid },
      });
    });
  }

  async logout(token: string): Promise<{ message: string }> {
    const hashedToken = createHash("sha256").update(token).digest("hex");

    await this.prisma.refreshToken.deleteMany({
      where: { token: hashedToken },
    });

    return { message: "Logged out successfully!" };
  }
}
