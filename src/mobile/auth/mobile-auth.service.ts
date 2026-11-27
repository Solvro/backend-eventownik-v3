import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { PrismaService } from "src/prisma/prisma.service";

import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";

import { MobileEventService } from "../common/mobile-event.service";
import type { MobileMeView } from "../common/mobile-profile";
import { MOBILE_PROFILE_SELECT, toProfileView } from "../common/mobile-profile";
import { MobileOtpEmailService } from "./mobile-otp-email.service";
import { MobileTokenService } from "./mobile-token.service";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_PER_HOUR = 5;
const OTP_MIN_INTERVAL_MS = 60 * 1000;

const invalid = () => new UnauthorizedException("Invalid or expired code");

export interface MobileOtpVerifyResult extends MobileMeView {
  token: string;
  expiresAt: string;
}

@Injectable()
export class MobileAuthService {
  private readonly logger = new Logger(MobileAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mobileEventService: MobileEventService,
    private readonly tokenService: MobileTokenService,
    private readonly otpEmailService: MobileOtpEmailService,
  ) {}

  /** Never reveals whether the email belongs to a participant. */
  async requestOtp(slug: string, rawEmail: string): Promise<{ ok: true }> {
    const email = rawEmail.trim().toLowerCase();
    const { event } = await this.mobileEventService.getEnabledBySlug(slug);

    const participant = await this.findParticipant(event.uuid, email);
    if (participant === null) {
      this.logger.log(
        `OTP requested for an unknown email in event ${event.uuid}`,
      );
      return { ok: true };
    }

    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recent = await this.prisma.mobileOtpCode.findMany({
      where: { participantUuid: participant.uuid, createdAt: { gt: hourAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
      take: OTP_MAX_PER_HOUR,
    });
    if (
      recent.length >= OTP_MAX_PER_HOUR ||
      (recent.length > 0 &&
        now.getTime() - recent[0].createdAt.getTime() < OTP_MIN_INTERVAL_MS)
    ) {
      this.logger.warn(
        `OTP rate limit hit for participant ${participant.uuid}`,
      );
      return { ok: true };
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const [, created] = await this.prisma.$transaction([
      this.prisma.mobileOtpCode.updateMany({
        where: { participantUuid: participant.uuid, consumedAt: null },
        data: { consumedAt: now },
      }),
      this.prisma.mobileOtpCode.create({
        data: {
          participantUuid: participant.uuid,
          codeHash: this.hashCode(code, participant),
          expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        },
        select: { uuid: true },
      }),
    ]);

    try {
      await this.otpEmailService.enqueueOtpEmail(
        participant.email,
        event.name,
        code,
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue OTP email for participant ${participant.uuid}`,
        error instanceof Error ? error.stack : String(error),
      );
      // The code never left the server: drop it so it does not count against
      // the resend wait, and tell the client so the participant can retry
      await this.prisma.$transaction([
        this.prisma.mobileOtpCode.delete({ where: { uuid: created.uuid } }),
        // Bring back the codes this request had just retired
        this.prisma.mobileOtpCode.updateMany({
          where: { participantUuid: participant.uuid, consumedAt: now },
          data: { consumedAt: null },
        }),
      ]);
      throw new ServiceUnavailableException("Could not send the code");
    }
    return { ok: true };
  }

  async verifyOtp(
    slug: string,
    rawEmail: string,
    code: string,
  ): Promise<MobileOtpVerifyResult> {
    const email = rawEmail.trim().toLowerCase();
    const { event } = await this.mobileEventService.getEnabledBySlug(slug);

    const participant = await this.findParticipant(event.uuid, email);
    if (participant === null) {
      throw invalid();
    }

    const now = new Date();
    const otp = await this.prisma.mobileOtpCode.findFirst({
      where: {
        participantUuid: participant.uuid,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      select: { uuid: true, codeHash: true },
      orderBy: { createdAt: "desc" },
    });
    if (otp === null) {
      throw invalid();
    }

    // Count the attempt atomically before comparing, so parallel guesses cannot exceed the limit.
    const attempt = await this.prisma.mobileOtpCode.updateMany({
      where: {
        uuid: otp.uuid,
        attempts: { lt: OTP_MAX_ATTEMPTS },
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { attempts: { increment: 1 } },
    });
    if (attempt.count === 0) {
      throw invalid();
    }

    const expected = Buffer.from(otp.codeHash, "hex");
    const actual = Buffer.from(this.hashCode(code, participant), "hex");
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw invalid();
    }

    const consumed = await this.prisma.mobileOtpCode.updateMany({
      where: { uuid: otp.uuid, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count === 0) {
      throw invalid();
    }

    const profile = await this.prisma.mobileProfile.findUnique({
      where: { participantUuid: participant.uuid },
      select: MOBILE_PROFILE_SELECT,
    });
    const { token, expiresAt } = this.tokenService.sign(
      participant.uuid,
      event.uuid,
      participant.email,
    );
    return {
      token,
      expiresAt: expiresAt.toISOString(),
      participant: { uuid: participant.uuid, email: participant.email },
      profile: toProfileView(profile),
    };
  }

  private async findParticipant(
    eventUuid: string,
    email: string,
  ): Promise<{ uuid: string; email: string } | null> {
    return this.prisma.participant.findFirst({
      where: { eventUuid, email: { equals: email, mode: "insensitive" } },
      select: { uuid: true, email: true },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * The hash covers the email the code was sent to, so a code mailed to an old
   * address stops working once the participant's email is changed.
   */
  private hashCode(
    code: string,
    participant: { uuid: string; email: string },
  ): string {
    const email = participant.email.trim().toLowerCase();
    return createHash("sha256")
      .update(`${code}${participant.uuid}${email}${this.tokenService.secret}`)
      .digest("hex");
  }
}
