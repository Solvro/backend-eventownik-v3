import { PrismaService } from "src/prisma/prisma.service";

import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import type { ParticipantContext } from "../auth/current-participant.decorator";
import { MobileImageService } from "../common/mobile-image.service";
import { toPerson } from "../common/mobile-person";
import { loadProfiles } from "./social-utils";
import type {
  MobileSoundboardDto,
  MobileSoundboardPadDto,
} from "./social.types";

export const SOUNDBOARD_SLOTS = 9;

/** Uploads cost storage, so one person can save only so many pads in a row */
const SAVE_LIMIT = 20;
const SAVE_WINDOW_MS = 10 * 60_000;
const MAX_TRACKED_PARTICIPANTS = 10_000;

const PAD_SELECT = {
  uuid: true,
  slot: true,
  caption: true,
  audioKey: true,
  audioMime: true,
  durationMs: true,
  imageKey: true,
  participantUuid: true,
  updatedAt: true,
} as const;

interface PadRow {
  uuid: string;
  slot: number;
  caption: string;
  audioKey: string;
  audioMime: string;
  durationMs: number | null;
  imageKey: string | null;
  participantUuid: string | null;
  updatedAt: Date;
}

export interface SoundboardPadInput {
  caption: string;
  durationMs?: number;
  removeImage?: boolean;
  audio?: Express.Multer.File;
  image?: Express.Multer.File;
}

@Injectable()
export class MobileSoundboardService {
  private readonly logger = new Logger(MobileSoundboardService.name);
  /** participant uuid -> times of recent saves */
  private readonly recentSaves = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mobileImageService: MobileImageService,
  ) {}

  async board(eventUuid: string): Promise<MobileSoundboardDto> {
    const rows = await this.prisma.mobileSoundboardPad.findMany({
      where: { eventUuid },
      select: PAD_SELECT,
    });
    const profiles = await loadProfiles(
      this.prisma,
      rows.flatMap((row) =>
        row.participantUuid === null ? [] : [row.participantUuid],
      ),
    );
    const pads: (MobileSoundboardPadDto | null)[] = Array.from(
      { length: SOUNDBOARD_SLOTS },
      () => null,
    );
    for (const row of rows) {
      if (row.slot >= 0 && row.slot < SOUNDBOARD_SLOTS) {
        pads[row.slot] = this.toDto(row, profiles);
      }
    }
    return { pads };
  }

  /**
   * Records over a pad or edits it. A new sound is required only for an empty
   * pad; otherwise whatever is not sent stays as it was.
   */
  async save(
    me: ParticipantContext,
    slot: number,
    input: SoundboardPadInput,
  ): Promise<MobileSoundboardDto> {
    this.assertSlot(slot);
    this.throttle(me.uuid);

    const existing = await this.prisma.mobileSoundboardPad.findUnique({
      where: { eventUuid_slot: { eventUuid: me.eventUuid, slot } },
      select: PAD_SELECT,
    });
    if (existing === null && input.audio === undefined) {
      throw new BadRequestException("Record a sound for an empty pad");
    }

    const audio =
      input.audio === undefined
        ? undefined
        : await this.mobileImageService.uploadAudio(input.audio);
    let imageKey: string | null | undefined;
    try {
      imageKey =
        input.image === undefined
          ? input.removeImage === true
            ? null
            : undefined
          : await this.mobileImageService.upload(input.image);
    } catch (error) {
      await this.discard(audio?.key);
      throw error;
    }

    const data = {
      caption: input.caption,
      participantUuid: me.uuid,
      ...(audio === undefined
        ? {}
        : {
            audioKey: audio.key,
            audioMime: audio.mime,
            durationMs: input.durationMs ?? null,
          }),
      ...(imageKey === undefined ? {} : { imageKey }),
    };
    try {
      if (existing === null) {
        if (audio === undefined) {
          throw new BadRequestException("Record a sound for an empty pad");
        }
        await this.prisma.mobileSoundboardPad.upsert({
          where: { eventUuid_slot: { eventUuid: me.eventUuid, slot } },
          create: {
            ...data,
            eventUuid: me.eventUuid,
            slot,
            audioKey: audio.key,
            audioMime: audio.mime,
          },
          update: data,
        });
      } else {
        await this.prisma.mobileSoundboardPad.update({
          where: { uuid: existing.uuid },
          data,
        });
      }
    } catch (error) {
      await this.discard(audio?.key);
      await this.discard(imageKey ?? undefined);
      throw error;
    }

    // The replaced files are no longer referenced by anything
    if (existing !== null) {
      if (audio !== undefined) {
        await this.discard(existing.audioKey);
      }
      if (imageKey !== undefined) {
        await this.discard(existing.imageKey ?? undefined);
      }
    }
    return this.board(me.eventUuid);
  }

  /** Empties a pad; anyone can, the same as recording over it */
  async clear(eventUuid: string, slot: number): Promise<MobileSoundboardDto> {
    this.assertSlot(slot);
    const existing = await this.prisma.mobileSoundboardPad.findUnique({
      where: { eventUuid_slot: { eventUuid, slot } },
      select: { uuid: true, audioKey: true, imageKey: true },
    });
    if (existing === null) {
      throw new NotFoundException("Pad is already empty");
    }
    await this.prisma.mobileSoundboardPad.deleteMany({
      where: { uuid: existing.uuid },
    });
    await this.discard(existing.audioKey);
    await this.discard(existing.imageKey ?? undefined);
    return this.board(eventUuid);
  }

  private assertSlot(slot: number): void {
    if (!Number.isInteger(slot) || slot < 0 || slot >= SOUNDBOARD_SLOTS) {
      throw new BadRequestException(
        `Pad must be between 0 and ${String(SOUNDBOARD_SLOTS - 1)}`,
      );
    }
  }

  private throttle(participantUuid: string): void {
    const now = Date.now();
    const recent = (this.recentSaves.get(participantUuid) ?? []).filter(
      (time) => now - time < SAVE_WINDOW_MS,
    );
    if (recent.length >= SAVE_LIMIT) {
      throw new HttpException(
        "Too many soundboard changes, try again later",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (
      !this.recentSaves.has(participantUuid) &&
      this.recentSaves.size >= MAX_TRACKED_PARTICIPANTS
    ) {
      this.recentSaves.clear();
    }
    recent.push(now);
    this.recentSaves.set(participantUuid, recent);
  }

  /** Storage cleanup must not fail the request that triggered it */
  private async discard(key: string | undefined): Promise<void> {
    if (key === undefined) {
      return;
    }
    try {
      await this.mobileImageService.delete(key);
    } catch (error) {
      this.logger.warn(
        `Could not delete soundboard file ${key}: ${String(error)}`,
      );
    }
  }

  private toDto(
    row: PadRow,
    profiles: Awaited<ReturnType<typeof loadProfiles>>,
  ): MobileSoundboardPadDto {
    return {
      uuid: row.uuid,
      slot: row.slot,
      caption: row.caption,
      audioUrl: this.mobileImageService.url(row.audioKey) ?? "",
      audioMime: row.audioMime,
      durationMs: row.durationMs,
      imageUrl: this.mobileImageService.url(row.imageKey),
      author:
        row.participantUuid === null
          ? null
          : toPerson(profiles.get(row.participantUuid), row.participantUuid),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
