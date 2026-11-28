import type { MobileApp } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import type { ParticipantContext } from "../auth/current-participant.decorator";

export type MobileFeature =
  "bereal" | "bingo" | "chat" | "schedule" | "sos" | "soundboard" | "tinder";

export interface MobileEventInfo {
  uuid: string;
  name: string;
  slug: string;
  primaryColor: string | null;
  photoKey: string | null;
  startDate: Date;
  endDate: Date;
  location: string | null;
  organizerName: string | null;
}

export interface MobileEventSnapshot {
  event: MobileEventInfo;
  /** null when the organizer never configured the app (treated as disabled) */
  app: MobileApp | null;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const EVENT_TTL_MS = 15_000;
const PARTICIPANT_TTL_MS = 60_000;
const MAX_EVENT_ENTRIES = 2000;
const MAX_PARTICIPANT_ENTRIES = 50_000;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EVENT_SELECT = {
  uuid: true,
  name: true,
  slug: true,
  primaryColor: true,
  photoKey: true,
  startDate: true,
  endDate: true,
  location: true,
  organizerName: true,
  mobileApp: true,
} as const;

const FEATURE_COLUMNS = {
  bereal: "berealEnabled",
  bingo: "bingoEnabled",
  chat: "chatEnabled",
  schedule: "scheduleEnabled",
  sos: "sosEnabled",
  soundboard: "soundboardEnabled",
  tinder: "tinderEnabled",
} as const satisfies Record<MobileFeature, keyof MobileApp>;

@Injectable()
export class MobileEventService {
  /** slug -> snapshot (null = no such event) */
  private readonly bySlug = new Map<
    string,
    CacheEntry<MobileEventSnapshot | null>
  >();
  /** event uuid -> slug, to resolve and invalidate by uuid */
  private readonly slugByUuid = new Map<string, string>();
  private readonly participants = new Map<
    string,
    CacheEntry<ParticipantContext>
  >();

  constructor(private readonly prisma: PrismaService) {}

  /** Event + app config by slug, cached ~15 s. Throws 404 when the event does not exist. */
  async getBySlug(slug: string): Promise<MobileEventSnapshot> {
    const now = Date.now();
    const cached = this.bySlug.get(slug);
    if (cached !== undefined && cached.expiresAt > now) {
      if (cached.value === null) {
        throw new NotFoundException("Event not found");
      }
      return cached.value;
    }

    const row = await this.prisma.event.findUnique({
      where: { slug },
      select: EVENT_SELECT,
    });
    const snapshot = row === null ? null : this.toSnapshot(row);
    this.remember(slug, snapshot, now);
    if (snapshot === null) {
      throw new NotFoundException("Event not found");
    }
    return snapshot;
  }

  /** Same as getBySlug, keyed by the event uuid. */
  async getByUuid(eventUuid: string): Promise<MobileEventSnapshot> {
    const slug = this.slugByUuid.get(eventUuid);
    if (slug !== undefined) {
      const cached = this.bySlug.get(slug);
      if (
        cached !== undefined &&
        cached.expiresAt > Date.now() &&
        cached.value?.event.uuid === eventUuid
      ) {
        return cached.value;
      }
    }

    const row = await this.prisma.event.findUnique({
      where: { uuid: eventUuid },
      select: EVENT_SELECT,
    });
    if (row === null) {
      throw new NotFoundException("Event not found");
    }
    const snapshot = this.toSnapshot(row);
    this.remember(snapshot.event.slug, snapshot, Date.now());
    return snapshot;
  }

  /** Like getBySlug, but 404 unless the mobile app is enabled for the event. */
  async getEnabledBySlug(
    slug: string,
  ): Promise<{ event: MobileEventInfo; app: MobileApp }> {
    const { event, app } = await this.getBySlug(slug);
    if (app?.isEnabled !== true) {
      throw new NotFoundException("Mobile app is not enabled for this event");
    }
    return { event, app };
  }

  /** Throws ForbiddenException when the app or the given feature is disabled. */
  async assertFeature(
    eventUuidOrSlug: string,
    feature: MobileFeature,
  ): Promise<void> {
    const { app } = UUID_REGEX.test(eventUuidOrSlug)
      ? await this.getByUuid(eventUuidOrSlug)
      : await this.getBySlug(eventUuidOrSlug);
    if (app?.isEnabled !== true || !app[FEATURE_COLUMNS[feature]]) {
      throw new ForbiddenException(`Feature "${feature}" is disabled`);
    }
  }

  /** Drop the cached event/app config (call after the organizer changes it). */
  invalidate(eventUuid: string): void {
    const slug = this.slugByUuid.get(eventUuid);
    if (slug !== undefined) {
      this.bySlug.delete(slug);
      this.slugByUuid.delete(eventUuid);
    }
  }

  /** Participant identity by uuid, cached ~60 s. null when the participant no longer exists. */
  async getParticipant(uuid: string): Promise<ParticipantContext | null> {
    const now = Date.now();
    const cached = this.participants.get(uuid);
    if (cached !== undefined && cached.expiresAt > now) {
      return cached.value;
    }

    const participant = await this.prisma.participant.findUnique({
      where: { uuid },
      select: { uuid: true, eventUuid: true, email: true },
    });
    if (participant === null) {
      this.participants.delete(uuid);
      return null;
    }
    if (this.participants.size >= MAX_PARTICIPANT_ENTRIES) {
      this.participants.clear();
    }
    this.participants.set(uuid, {
      value: participant,
      expiresAt: now + PARTICIPANT_TTL_MS,
    });
    return participant;
  }

  private toSnapshot(
    row: MobileEventInfo & { mobileApp: MobileApp | null },
  ): MobileEventSnapshot {
    const { mobileApp, ...event } = row;
    return { event, app: mobileApp };
  }

  private remember(
    slug: string,
    snapshot: MobileEventSnapshot | null,
    now: number,
  ): void {
    if (this.bySlug.size >= MAX_EVENT_ENTRIES) {
      this.bySlug.clear();
      this.slugByUuid.clear();
    }
    this.bySlug.set(slug, { value: snapshot, expiresAt: now + EVENT_TTL_MS });
    if (snapshot !== null) {
      this.slugByUuid.set(snapshot.event.uuid, slug);
    }
  }
}
