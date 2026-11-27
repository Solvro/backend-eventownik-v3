import { createHmac, randomInt } from "node:crypto";
import { TokenResponseDto } from "src/auth/dto/token-response.dto";
import { ParticipantsService } from "src/participants/participants.service";
import { PrismaService } from "src/prisma/prisma.service";

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { CodeVerificationRequestDTO } from "./dto/code-verification-rquest.dto";
import { RequestLoginCodeRequestDTO } from "./dto/request-code-request.dto";

@Injectable()
export class ParticipantsAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly participantsService: ParticipantsService,
    private readonly configService: ConfigService,
  ) {}

  async sendLoginCode(
    requestLoginCodeRequestDTO: RequestLoginCodeRequestDTO,
  ): Promise<void> {
    const email = requestLoginCodeRequestDTO.email;

    const participantExists =
      await this.participantsService.existsByEmail(email);

    if (!participantExists) {
      return;
    }

    const loginCode = this.generateLoginCode();
    const loginCodeHash = this.hashLoginCode(email, loginCode);

    await this.prisma.participantLoginCode.upsert({
      where: { email },
      create: {
        email,
        codeHash: loginCodeHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
      update: {
        codeHash: loginCodeHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
      },
    });

    //TODO: send the code
    console.log(loginCode);
  }

  async vrifyCode(
    codeVerificationRequestDTO: CodeVerificationRequestDTO,
  ): Promise<TokenResponseDto> {
    const { email, code } = codeVerificationRequestDTO;

    const result = await this.prisma.participantLoginCode.updateMany({
      where: { email, attempts: { lt: 5 }, expiresAt: { gt: new Date() } },
      data: { attempts: { increment: 1 } },
    });

    if (!result.count) {
      throw new UnauthorizedException("Invalid or expired login code");
    }

    const codeHash = this.hashLoginCode(email, code);

    const consumed = await this.prisma.participantLoginCode.deleteMany({
      where: {
        email,
        codeHash,
        expiresAt: { gt: new Date() },
      },
    });

    if (!consumed.count) {
      throw new UnauthorizedException("Invalid or expired login code");
    }

    //TODO: if login successful create user account
  }

  // async refresh(): Promise<void> {}

  // async logout(): Promise<void> {}

  generateLoginCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, "0");
  }

  hashLoginCode(email: string, code: string): string {
    return createHmac(
      "sha256",
      this.configService.getOrThrow<string>("OTP_SECRET"),
    )
      .update(`${email}:${code}`)
      .digest("hex");
  }
}
