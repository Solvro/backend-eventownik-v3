import { PrismaService } from "src/prisma/prisma.service";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import type { ParticipantContext } from "../auth/current-participant.decorator";
import { MobileImageService } from "../common/mobile-image.service";
import { toPerson } from "../common/mobile-person";
import { isUniqueViolation, loadProfiles } from "./social-utils";
import type {
  MobileBerealPostDto,
  MobileBerealRoundAdminDto,
  MobileBerealRoundDto,
  MobileBerealStateDto,
} from "./social.types";

const DEFAULT_DURATION_MINUTES = 5;
const FEED_LIMIT = 300;
const NOTIFICATION_TITLE = "Czas na BeReal!";
const NOTIFICATION_DEFAULT_BODY =
  "Masz chwilę, żeby zrobić zdjęcie i pokazać, co teraz robisz!";

const ROUND_SELECT = {
  uuid: true,
  eventUuid: true,
  prompt: true,
  startedAt: true,
  endsAt: true,
} as const;

const POST_SELECT = {
  uuid: true,
  participantUuid: true,
  photoKey: true,
  selfieKey: true,
  caption: true,
  isLate: true,
  createdAt: true,
} as const;

interface RoundRow {
  uuid: string;
  prompt: string | null;
  startedAt: Date;
  endsAt: Date;
}

interface PostRow {
  uuid: string;
  participantUuid: string;
  photoKey: string;
  selfieKey: string | null;
  caption: string | null;
  isLate: boolean;
  createdAt: Date;
}

@Injectable()
export class MobileBerealService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mobileImageService: MobileImageService,
  ) {}

  // -------------------------------------------------------------------------
  // Participant
  // -------------------------------------------------------------------------

  async state(me: ParticipantContext): Promise<MobileBerealStateDto> {
    const round = await this.latestRound(me.eventUuid);
    if (round === null) {
      return { round: null, isActive: false, myPost: null, canViewFeed: false };
    }
    const post = await this.prisma.mobileBerealPost.findUnique({
      where: {
        roundUuid_participantUuid: {
          roundUuid: round.uuid,
          participantUuid: me.uuid,
        },
      },
      select: POST_SELECT,
    });
    const isActive = Date.now() < round.endsAt.getTime();
    const myPosts = post === null ? [] : await this.toPosts([post], me.uuid);
    const myPost = myPosts.at(0) ?? null;
    return {
      round: this.toRound(round),
      isActive,
      myPost,
      canViewFeed: post !== null || !isActive,
    };
  }

  async createPost(
    me: ParticipantContext,
    roundUuid: string,
    files: { photo?: Express.Multer.File[]; selfie?: Express.Multer.File[] },
    caption: string | undefined,
  ): Promise<MobileBerealPostDto> {
    const latest = await this.latestRound(me.eventUuid);
    if (latest?.uuid !== roundUuid) {
      throw new NotFoundException("Round not found or no longer active");
    }
    const photo = files.photo?.at(0);
    if (photo === undefined) {
      throw new BadRequestException("Photo is required");
    }

    const existing = await this.prisma.mobileBerealPost.findUnique({
      where: {
        roundUuid_participantUuid: { roundUuid, participantUuid: me.uuid },
      },
      select: { uuid: true },
    });
    if (existing !== null) {
      throw new ConflictException("You already posted in this round");
    }

    const selfie = files.selfie?.at(0);
    const photoKey = await this.mobileImageService.upload(photo);
    let selfieKey: string | null = null;
    try {
      selfieKey =
        selfie === undefined
          ? null
          : await this.mobileImageService.upload(selfie);
      const post = await this.prisma.mobileBerealPost.create({
        data: {
          roundUuid,
          participantUuid: me.uuid,
          photoKey,
          selfieKey,
          caption: caption === undefined || caption === "" ? null : caption,
          isLate: Date.now() > latest.endsAt.getTime(),
        },
        select: POST_SELECT,
      });
      const [dto] = await this.toPosts([post], me.uuid);
      return dto;
    } catch (error) {
      await this.safeDelete(photoKey);
      await this.safeDelete(selfieKey);
      if (isUniqueViolation(error)) {
        throw new ConflictException("You already posted in this round");
      }
      throw error;
    }
  }

  async feed(
    me: ParticipantContext,
    roundUuid: string,
  ): Promise<MobileBerealPostDto[]> {
    const round = await this.prisma.mobileBerealRound.findUnique({
      where: { uuid: roundUuid },
      select: { eventUuid: true, endsAt: true },
    });
    if (round?.eventUuid !== me.eventUuid) {
      throw new NotFoundException("Round not found");
    }
    if (Date.now() < round.endsAt.getTime()) {
      const mine = await this.prisma.mobileBerealPost.findUnique({
        where: {
          roundUuid_participantUuid: { roundUuid, participantUuid: me.uuid },
        },
        select: { uuid: true },
      });
      if (mine === null) {
        throw new ForbiddenException("Post your photo first");
      }
    }
    return this.listPosts(roundUuid, me.uuid);
  }

  // -------------------------------------------------------------------------
  // Organizer
  // -------------------------------------------------------------------------

  async listRounds(eventUuid: string): Promise<MobileBerealRoundAdminDto[]> {
    const rounds = await this.prisma.mobileBerealRound.findMany({
      where: { eventUuid },
      orderBy: { startedAt: "desc" },
      select: { ...ROUND_SELECT, _count: { select: { posts: true } } },
    });
    return rounds.map((round) => ({
      ...this.toRound(round),
      postsCount: round._count.posts,
    }));
  }

  async createRound(
    eventUuid: string,
    adminUuid: string,
    prompt: string | undefined,
    durationMinutes: number | undefined,
  ): Promise<MobileBerealRoundAdminDto> {
    const now = new Date();
    const minutes = durationMinutes ?? DEFAULT_DURATION_MINUTES;
    const cleanPrompt = prompt === undefined || prompt === "" ? null : prompt;
    const [round] = await this.prisma.$transaction([
      this.prisma.mobileBerealRound.create({
        data: {
          eventUuid,
          prompt: cleanPrompt,
          startedAt: now,
          endsAt: new Date(now.getTime() + minutes * 60_000),
        },
        select: ROUND_SELECT,
      }),
      this.prisma.mobileNotification.create({
        data: {
          eventUuid,
          title: NOTIFICATION_TITLE,
          body: cleanPrompt ?? NOTIFICATION_DEFAULT_BODY,
          createdByAdminUuid: adminUuid,
        },
        select: { uuid: true },
      }),
    ]);
    return { ...this.toRound(round), postsCount: 0 };
  }

  async deleteRound(eventUuid: string, roundUuid: string): Promise<void> {
    await this.assertRoundInEvent(roundUuid, eventUuid);
    const posts = await this.prisma.mobileBerealPost.findMany({
      where: { roundUuid },
      select: { photoKey: true, selfieKey: true },
    });
    await this.prisma.mobileBerealRound.delete({ where: { uuid: roundUuid } });
    await Promise.all(
      posts.flatMap((post) => [
        this.safeDelete(post.photoKey),
        this.safeDelete(post.selfieKey),
      ]),
    );
  }

  async adminListPosts(
    eventUuid: string,
    roundUuid: string,
  ): Promise<MobileBerealPostDto[]> {
    await this.assertRoundInEvent(roundUuid, eventUuid);
    return this.listPosts(roundUuid, null);
  }

  async adminDeletePost(eventUuid: string, postUuid: string): Promise<void> {
    const post = await this.prisma.mobileBerealPost.findUnique({
      where: { uuid: postUuid },
      select: {
        photoKey: true,
        selfieKey: true,
        round: { select: { eventUuid: true } },
      },
    });
    if (post?.round.eventUuid !== eventUuid) {
      throw new NotFoundException("Post not found");
    }
    await this.prisma.mobileBerealPost.delete({ where: { uuid: postUuid } });
    await this.safeDelete(post.photoKey);
    await this.safeDelete(post.selfieKey);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async latestRound(
    eventUuid: string,
  ): Promise<(RoundRow & { eventUuid: string }) | null> {
    return this.prisma.mobileBerealRound.findFirst({
      where: { eventUuid },
      orderBy: { startedAt: "desc" },
      select: ROUND_SELECT,
    });
  }

  private async assertRoundInEvent(
    roundUuid: string,
    eventUuid: string,
  ): Promise<void> {
    const round = await this.prisma.mobileBerealRound.findUnique({
      where: { uuid: roundUuid },
      select: { eventUuid: true },
    });
    if (round?.eventUuid !== eventUuid) {
      throw new NotFoundException("Round not found");
    }
  }

  private async listPosts(
    roundUuid: string,
    meUuid: string | null,
  ): Promise<MobileBerealPostDto[]> {
    const posts = await this.prisma.mobileBerealPost.findMany({
      where: { roundUuid },
      orderBy: { createdAt: "desc" },
      take: FEED_LIMIT,
      select: POST_SELECT,
    });
    return this.toPosts(posts, meUuid);
  }

  private async toPosts(
    posts: PostRow[],
    meUuid: string | null,
  ): Promise<MobileBerealPostDto[]> {
    const profiles = await loadProfiles(
      this.prisma,
      posts.map((post) => post.participantUuid),
    );
    return posts.map((post) => ({
      uuid: post.uuid,
      photoUrl: this.mobileImageService.url(post.photoKey) ?? "",
      selfieUrl: this.mobileImageService.url(post.selfieKey),
      caption: post.caption,
      isLate: post.isLate,
      createdAt: post.createdAt.toISOString(),
      author: toPerson(
        profiles.get(post.participantUuid),
        post.participantUuid,
      ),
      isMine: meUuid !== null && post.participantUuid === meUuid,
    }));
  }

  private toRound(round: RoundRow): MobileBerealRoundDto {
    return {
      uuid: round.uuid,
      prompt: round.prompt,
      startedAt: round.startedAt.toISOString(),
      endsAt: round.endsAt.toISOString(),
    };
  }

  private async safeDelete(key: string | null): Promise<void> {
    try {
      await this.mobileImageService.delete(key);
    } catch {
      // the row is gone; a leftover object in storage is harmless
    }
  }
}
