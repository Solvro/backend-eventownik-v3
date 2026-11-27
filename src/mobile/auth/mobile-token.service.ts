import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

export const MOBILE_TOKEN_AUDIENCE = "mobile";
export const MOBILE_TOKEN_TYP = "participant";
const MOBILE_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface MobileTokenPayload {
  sub: string;
  eventUuid: string;
  typ: typeof MOBILE_TOKEN_TYP;
  /** Fingerprint of the email the participant logged in with, see `emailFingerprint` */
  em: string;
}

/**
 * Short hash of a participant email. Stored in the token so that sessions stop
 * working once the participant's email is changed to someone else's.
 */
export function emailFingerprint(email: string): string {
  return createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 16);
}

@Injectable()
export class MobileTokenService {
  /** Derived from JWT_SECRET so that participant tokens never verify as admin tokens. */
  readonly secret: string;

  constructor(
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.secret = createHash("sha256")
      .update(
        `mobile-participant:${configService.getOrThrow<string>("JWT_SECRET")}`,
      )
      .digest("hex");
  }

  sign(
    participantUuid: string,
    eventUuid: string,
    email: string,
  ): { token: string; expiresAt: Date } {
    const token = this.jwtService.sign(
      {
        sub: participantUuid,
        eventUuid,
        typ: MOBILE_TOKEN_TYP,
        em: emailFingerprint(email),
      } satisfies MobileTokenPayload,
      {
        secret: this.secret,
        algorithm: "HS256",
        audience: MOBILE_TOKEN_AUDIENCE,
        expiresIn: "7d",
      },
    );
    return {
      token,
      expiresAt: new Date(Date.now() + MOBILE_TOKEN_TTL_SECONDS * 1000),
    };
  }

  /** Returns null for anything that is not a valid, unexpired participant token. */
  verify(token: string): MobileTokenPayload | null {
    let payload: Partial<MobileTokenPayload>;
    try {
      payload = this.jwtService.verify<Partial<MobileTokenPayload>>(token, {
        secret: this.secret,
        algorithms: ["HS256"],
        audience: MOBILE_TOKEN_AUDIENCE,
      });
    } catch {
      return null;
    }
    if (
      payload.typ !== MOBILE_TOKEN_TYP ||
      typeof payload.sub !== "string" ||
      typeof payload.eventUuid !== "string" ||
      typeof payload.em !== "string"
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      eventUuid: payload.eventUuid,
      typ: MOBILE_TOKEN_TYP,
      em: payload.em,
    };
  }
}
