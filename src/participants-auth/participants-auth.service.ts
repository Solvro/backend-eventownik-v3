import { createHmac, randomInt } from "node:crypto";
import { ParticipantsService } from "src/participants/participants.service";
import { PrismaService } from "src/prisma/prisma.service";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

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
