import { PrismaService } from "src/prisma/prisma.service";
import * as webpush from "web-push";

import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ParticipantContext } from "../auth/current-participant.decorator";
import type {
  MobilePushConfigDto,
  MobilePushSubscribeDto,
} from "../dto/push.dto";

/** What the service worker receives (JSON). `url` is a site-relative path. */
export interface MobilePushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

export interface MobilePushOptions {
  /** How long the push service keeps an undelivered message, in seconds */
  ttlSeconds?: number;
  urgency?: webpush.Urgency;
}

const MAX_SUBSCRIPTIONS_PER_PARTICIPANT = 10;
const BATCH_SIZE = 20;
const SEND_TIMEOUT_MS = 10_000;
const DEFAULT_TTL_SECONDS = 6 * 60 * 60;
const TITLE_MAX = 100;
const BODY_MAX = 180;
const URL_MAX = 300;
const TAG_MAX = 100;

interface SubscriptionRow {
  uuid: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

const SUBSCRIPTION_SELECT = {
  uuid: true,
  endpoint: true,
  p256dh: true,
  auth: true,
} as const;

function truncate(value: string, max: number): string {
  const clean = value.replaceAll(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

/**
 * Standard VAPID Web Push. Completely inert unless VAPID_PUBLIC_KEY and
 * VAPID_PRIVATE_KEY are set: nothing is sent and subscribing returns 404.
 * Sending is fire and forget: it never throws into, or delays, the caller.
 */
@Injectable()
export class MobilePushService {
  private readonly logger = new Logger(MobilePushService.name);
  private readonly vapid: (webpush.VapidKeys & { subject: string }) | null;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.vapid = this.loadVapid(configService);
  }

  get isEnabled(): boolean {
    return this.vapid !== null;
  }

  getConfig(): MobilePushConfigDto {
    return {
      enabled: this.vapid !== null,
      publicKey: this.vapid?.publicKey ?? null,
    };
  }

  async subscribe(
    participant: ParticipantContext,
    dto: MobilePushSubscribeDto,
  ): Promise<void> {
    if (this.vapid === null) {
      throw new NotFoundException("Push notifications are not configured");
    }
    const data = {
      participantUuid: participant.uuid,
      eventUuid: participant.eventUuid,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
    };
    // An endpoint identifies one browser install: it moves to whoever subscribed last
    await this.prisma.mobilePushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: { ...data, endpoint: dto.endpoint },
      update: { ...data, createdAt: new Date() },
      select: { uuid: true },
    });

    const stale = await this.prisma.mobilePushSubscription.findMany({
      where: { participantUuid: participant.uuid },
      orderBy: { createdAt: "desc" },
      skip: MAX_SUBSCRIPTIONS_PER_PARTICIPANT,
      select: { uuid: true },
    });
    if (stale.length > 0) {
      await this.prisma.mobilePushSubscription.deleteMany({
        where: { uuid: { in: stale.map((row) => row.uuid) } },
      });
    }
  }

  async unsubscribe(
    participant: ParticipantContext,
    endpoint: string,
  ): Promise<void> {
    await this.prisma.mobilePushSubscription.deleteMany({
      where: { endpoint, participantUuid: participant.uuid },
    });
  }

  /** Push to every subscribed device in the event. Fire and forget. */
  sendToEvent(
    eventUuid: string,
    payload: MobilePushPayload,
    options: MobilePushOptions = {},
  ): void {
    this.run("sendToEvent", async () => {
      const rows = await this.prisma.mobilePushSubscription.findMany({
        where: { eventUuid },
        select: SUBSCRIPTION_SELECT,
      });
      await this.deliver(rows, payload, options);
    });
  }

  /** Push to the devices of the given participants. Fire and forget. */
  sendToParticipants(
    participantUuids: string[],
    payload: MobilePushPayload,
    options: MobilePushOptions = {},
  ): void {
    if (participantUuids.length === 0) {
      return;
    }
    this.run("sendToParticipants", async () => {
      const rows = await this.prisma.mobilePushSubscription.findMany({
        where: { participantUuid: { in: participantUuids } },
        select: SUBSCRIPTION_SELECT,
      });
      await this.deliver(rows, payload, options);
    });
  }

  /**
   * Run push-related work in the background (e.g. lookups needed to build a
   * payload). Skipped entirely when push is disabled; errors are only logged.
   */
  run(label: string, task: () => Promise<void>): void {
    if (this.vapid === null) {
      return;
    }
    try {
      task().catch((error: unknown) => {
        this.logger.error(`Push ${label} failed`, error);
      });
    } catch (error) {
      this.logger.error(`Push ${label} failed`, error);
    }
  }

  private async deliver(
    rows: SubscriptionRow[],
    payload: MobilePushPayload,
    options: MobilePushOptions,
  ): Promise<void> {
    const vapid = this.vapid;
    if (vapid === null || rows.length === 0) {
      return;
    }
    const body = JSON.stringify({
      title: truncate(payload.title, TITLE_MAX),
      body: truncate(payload.body, BODY_MAX),
      url: payload.url.slice(0, URL_MAX),
      ...(payload.tag === undefined
        ? {}
        : { tag: payload.tag.slice(0, TAG_MAX) }),
    });
    const requestOptions: webpush.RequestOptions = {
      vapidDetails: vapid,
      TTL: Math.max(0, Math.round(options.ttlSeconds ?? DEFAULT_TTL_SECONDS)),
      urgency: options.urgency ?? "normal",
      timeout: SEND_TIMEOUT_MS,
    };

    const gone: string[] = [];
    let failed = 0;
    for (let index = 0; index < rows.length; index += BATCH_SIZE) {
      const batch = rows.slice(index, index + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (row) =>
          webpush.sendNotification(
            {
              endpoint: row.endpoint,
              keys: { p256dh: row.p256dh, auth: row.auth },
            },
            body,
            requestOptions,
          ),
        ),
      );
      for (const [position, result] of results.entries()) {
        if (result.status === "fulfilled") {
          continue;
        }
        const statusCode = (result.reason as { statusCode?: unknown })
          .statusCode;
        if (statusCode === 404 || statusCode === 410) {
          gone.push(batch[position].uuid);
        } else {
          failed += 1;
          if (failed <= 3) {
            this.logger.warn(
              `Push to ${new URL(batch[position].endpoint).host} failed: ${
                typeof statusCode === "number"
                  ? `HTTP ${String(statusCode)}`
                  : String(result.reason)
              }`,
            );
          }
        }
      }
    }

    if (gone.length > 0) {
      await this.prisma.mobilePushSubscription.deleteMany({
        where: { uuid: { in: gone } },
      });
    }
    if (failed > 0 || gone.length > 0) {
      this.logger.log(
        `Push sent to ${String(rows.length - failed - gone.length)}/${String(rows.length)} devices (${String(gone.length)} expired removed, ${String(failed)} failed)`,
      );
    }
  }

  private loadVapid(
    configService: ConfigService,
  ): (webpush.VapidKeys & { subject: string }) | null {
    const publicKey = configService.get<string>("VAPID_PUBLIC_KEY")?.trim();
    const privateKey = configService.get<string>("VAPID_PRIVATE_KEY")?.trim();
    if (
      publicKey === undefined ||
      publicKey === "" ||
      privateKey === undefined ||
      privateKey === ""
    ) {
      return null;
    }
    const configuredSubject =
      configService.get<string>("VAPID_SUBJECT")?.trim() ?? "";
    const subject =
      configuredSubject === ""
        ? `mailto:${configService.get<string>("BBI_EMAIL") ?? "eventownik@pwr.edu.pl"}`
        : configuredSubject;
    try {
      // Validates the keys and the subject without sending anything
      webpush.getVapidHeaders(
        "https://push.example.com",
        subject,
        publicKey,
        privateKey,
        "aes128gcm",
      );
    } catch (error) {
      this.logger.error(
        "Invalid VAPID configuration, push notifications are disabled",
        error,
      );
      return null;
    }
    this.logger.log("Web Push enabled");
    return { publicKey, privateKey, subject };
  }
}
