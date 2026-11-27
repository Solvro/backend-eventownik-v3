import { PrismaService } from "src/prisma/prisma.service";

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import type { ParticipantContext } from "../auth/current-participant.decorator";
import { MobileEventService } from "../common/mobile-event.service";
import { toPerson } from "../common/mobile-person";
import { MobilePushService } from "../push/mobile-push.service";
import { directRoomKey, loadProfiles } from "./social-utils";
import type {
  MobileSwipeResultDto,
  MobileTinderCandidateDto,
  MobileTinderMatchAdminDto,
  MobileTinderMatchDto,
  MobileTinderOverviewDto,
  MobileTinderParticipantSwipesDto,
  MobileTinderPersonAdminDto,
  MobileTinderSwipeAdminDto,
} from "./social.types";

interface PersonStatsRow {
  participantUuid: string;
  displayName: string;
  photoKey: string | null;
  email: string;
  tinderOptIn: boolean;
  likesGiven: bigint;
  passesGiven: bigint;
  likesReceived: bigint;
  matchesCount: bigint;
}

@Injectable()
export class MobileTinderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mobileEventService: MobileEventService,
    private readonly mobilePushService: MobilePushService,
  ) {}

  async candidates(
    me: ParticipantContext,
    limit: number,
  ): Promise<MobileTinderCandidateDto[]> {
    await this.assertHasProfile(me);
    const rows = await this.prisma.$queryRaw<
      {
        participantUuid: string;
        displayName: string;
        bio: string | null;
        photoKey: string | null;
      }[]
    >`
      SELECT p."participantUuid"::text AS "participantUuid", p."displayName", p.bio, p."photoKey"
      FROM "MobileProfiles" p
      WHERE p."eventUuid" = ${me.eventUuid}::uuid
        AND p."tinderOptIn" = true
        AND p."participantUuid" <> ${me.uuid}::uuid
        AND NOT EXISTS (
          SELECT 1 FROM "MobileSwipes" s
          WHERE s."fromParticipantUuid" = ${me.uuid}::uuid
            AND s."toParticipantUuid" = p."participantUuid"
        )
      ORDER BY random()
      LIMIT ${limit}`;

    return rows.map((row) => ({
      ...toPerson(row, row.participantUuid),
      bio: row.bio,
    }));
  }

  async swipe(
    me: ParticipantContext,
    toParticipantUuid: string,
    liked: boolean,
  ): Promise<MobileSwipeResultDto> {
    if (toParticipantUuid === me.uuid) {
      throw new BadRequestException("You cannot swipe yourself");
    }
    await this.assertHasProfile(me);
    // Only people who opted into Tinderownik can be swiped, same as the candidate list
    const target = await this.prisma.mobileProfile.findUnique({
      where: { participantUuid: toParticipantUuid },
      select: { eventUuid: true, tinderOptIn: true },
    });
    if (target?.eventUuid !== me.eventUuid || !target.tinderOptIn) {
      throw new NotFoundException("Participant not found");
    }

    await this.prisma.mobileSwipe.upsert({
      where: {
        fromParticipantUuid_toParticipantUuid: {
          fromParticipantUuid: me.uuid,
          toParticipantUuid,
        },
      },
      create: {
        eventUuid: me.eventUuid,
        fromParticipantUuid: me.uuid,
        toParticipantUuid,
        liked,
      },
      update: { liked },
    });

    if (!liked) {
      return { matched: false, roomUuid: null };
    }

    const reverse = await this.prisma.mobileSwipe.findUnique({
      where: {
        fromParticipantUuid_toParticipantUuid: {
          fromParticipantUuid: toParticipantUuid,
          toParticipantUuid: me.uuid,
        },
      },
      select: { liked: true },
    });
    if (reverse?.liked !== true) {
      return { matched: false, roomUuid: null };
    }

    const roomUuid = await this.ensureDirectRoom(
      me.eventUuid,
      me.uuid,
      toParticipantUuid,
    );
    this.notifyMatch(me, toParticipantUuid, roomUuid);
    return { matched: true, roomUuid };
  }

  async matches(me: ParticipantContext): Promise<MobileTinderMatchDto[]> {
    const rows = await this.prisma.$queryRaw<{ participantUuid: string }[]>`
      SELECT s2."fromParticipantUuid"::text AS "participantUuid"
      FROM "MobileSwipes" s1
      JOIN "MobileSwipes" s2
        ON s2."fromParticipantUuid" = s1."toParticipantUuid"
       AND s2."toParticipantUuid" = s1."fromParticipantUuid"
       AND s2.liked = true
      WHERE s1."fromParticipantUuid" = ${me.uuid}::uuid
        AND s1."eventUuid" = ${me.eventUuid}::uuid
        AND s1.liked = true`;
    if (rows.length === 0) {
      return [];
    }

    const others = rows.map((row) => row.participantUuid);
    const keyToOther = new Map(
      others.map((other) => [directRoomKey(me.uuid, other), other]),
    );

    const [rooms, profiles] = await Promise.all([
      this.prisma.mobileChatRoom.findMany({
        where: { eventUuid: me.eventUuid, key: { in: [...keyToOther.keys()] } },
        select: { uuid: true, key: true, createdAt: true },
      }),
      this.prisma.mobileProfile.findMany({
        where: { participantUuid: { in: others } },
        select: {
          participantUuid: true,
          displayName: true,
          photoKey: true,
          bio: true,
        },
      }),
    ]);

    const roomByOther = new Map<string, { uuid: string; createdAt: Date }>();
    for (const room of rooms) {
      const other = keyToOther.get(room.key);
      if (other !== undefined) {
        roomByOther.set(other, room);
      }
    }
    // Heal mutual likes whose room was never created (e.g. a failed request).
    for (const other of others) {
      if (!roomByOther.has(other)) {
        const uuid = await this.ensureDirectRoom(me.eventUuid, me.uuid, other);
        roomByOther.set(other, { uuid, createdAt: new Date() });
      }
    }

    const profileByUuid = new Map(
      profiles.map((profile) => [profile.participantUuid, profile]),
    );

    return others
      .map((other) => {
        const room = roomByOther.get(other);
        const profile = profileByUuid.get(other);
        return {
          ...toPerson(profile, other),
          bio: profile?.bio ?? null,
          roomUuid: room?.uuid ?? "",
          matchedAt: (room?.createdAt ?? new Date()).toISOString(),
        };
      })
      .toSorted((a, b) => b.matchedAt.localeCompare(a.matchedAt));
  }

  // ------------------------------------------------------------ Organizer

  /** Everyone with a profile, their swipe counts, and every match of the event */
  async adminOverview(eventUuid: string): Promise<MobileTinderOverviewDto> {
    const [people, matchRows, totals] = await Promise.all([
      this.personStats(eventUuid, null),
      // Each mutual pair once (a < b); matched when the later like happened
      this.prisma.$queryRaw<{ a: string; b: string; matchedAt: Date }[]>`
        SELECT s1."fromParticipantUuid"::text AS a,
               s1."toParticipantUuid"::text AS b,
               GREATEST(s1."createdAt", s2."createdAt") AS "matchedAt"
        FROM "MobileSwipes" s1
        JOIN "MobileSwipes" s2
          ON s2."fromParticipantUuid" = s1."toParticipantUuid"
         AND s2."toParticipantUuid" = s1."fromParticipantUuid"
         AND s2.liked = true
        WHERE s1."eventUuid" = ${eventUuid}::uuid
          AND s1.liked = true
          AND s1."fromParticipantUuid" < s1."toParticipantUuid"
        ORDER BY "matchedAt" DESC`,
      this.prisma.mobileSwipe.groupBy({
        by: ["liked"],
        where: { eventUuid },
        _count: { _all: true },
      }),
    ]);

    const profiles = await loadProfiles(
      this.prisma,
      matchRows.flatMap((row) => [row.a, row.b]),
    );
    const matches: MobileTinderMatchAdminDto[] = matchRows.map((row) => ({
      a: toPerson(profiles.get(row.a), row.a),
      b: toPerson(profiles.get(row.b), row.b),
      matchedAt: row.matchedAt.toISOString(),
    }));

    const countOf = (liked: boolean) =>
      totals.find((group) => group.liked === liked)?._count._all ?? 0;

    return {
      totals: {
        optedIn: people.filter((person) => person.tinderOptIn).length,
        swipes: countOf(true) + countOf(false),
        likes: countOf(true),
        matches: matches.length,
      },
      people,
      matches,
    };
  }

  /** How one participant swiped, and how others swiped on them */
  async adminParticipantSwipes(
    eventUuid: string,
    participantUuid: string,
  ): Promise<MobileTinderParticipantSwipesDto> {
    const stats = await this.personStats(eventUuid, participantUuid);
    const participant = stats.at(0);
    if (participant === undefined) {
      throw new NotFoundException("Participant not found");
    }

    const [given, received] = await Promise.all([
      this.prisma.mobileSwipe.findMany({
        where: { eventUuid, fromParticipantUuid: participantUuid },
        select: { toParticipantUuid: true, liked: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.mobileSwipe.findMany({
        where: { eventUuid, toParticipantUuid: participantUuid },
        select: { fromParticipantUuid: true, liked: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Swipes are one row per direction, so each list answers the other
    const givenTo = new Map(
      given.map((swipe) => [swipe.toParticipantUuid, swipe.liked]),
    );
    const receivedFrom = new Map(
      received.map((swipe) => [swipe.fromParticipantUuid, swipe.liked]),
    );
    const profiles = await loadProfiles(this.prisma, [
      ...givenTo.keys(),
      ...receivedFrom.keys(),
    ]);

    const toRow = (
      other: string,
      liked: boolean,
      createdAt: Date,
      reciprocal: boolean | undefined,
    ): MobileTinderSwipeAdminDto => ({
      person: toPerson(profiles.get(other), other),
      liked,
      swipedAt: createdAt.toISOString(),
      reciprocal: reciprocal ?? null,
    });

    return {
      participant,
      given: given.map((swipe) =>
        toRow(
          swipe.toParticipantUuid,
          swipe.liked,
          swipe.createdAt,
          receivedFrom.get(swipe.toParticipantUuid),
        ),
      ),
      received: received.map((swipe) =>
        toRow(
          swipe.fromParticipantUuid,
          swipe.liked,
          swipe.createdAt,
          givenTo.get(swipe.fromParticipantUuid),
        ),
      ),
    };
  }

  /** Profiles of the event with swipe counts; one participant when given */
  private async personStats(
    eventUuid: string,
    participantUuid: string | null,
  ): Promise<MobileTinderPersonAdminDto[]> {
    const rows = await this.prisma.$queryRaw<PersonStatsRow[]>`
      SELECT p."participantUuid"::text AS "participantUuid",
             p."displayName", p."photoKey", pa.email, p."tinderOptIn",
             (SELECT COUNT(*) FROM "MobileSwipes" s
               WHERE s."fromParticipantUuid" = p."participantUuid" AND s.liked) AS "likesGiven",
             (SELECT COUNT(*) FROM "MobileSwipes" s
               WHERE s."fromParticipantUuid" = p."participantUuid" AND NOT s.liked) AS "passesGiven",
             (SELECT COUNT(*) FROM "MobileSwipes" s
               WHERE s."toParticipantUuid" = p."participantUuid" AND s.liked) AS "likesReceived",
             (SELECT COUNT(*) FROM "MobileSwipes" s1
               JOIN "MobileSwipes" s2
                 ON s2."fromParticipantUuid" = s1."toParticipantUuid"
                AND s2."toParticipantUuid" = s1."fromParticipantUuid"
                AND s2.liked
               WHERE s1."fromParticipantUuid" = p."participantUuid" AND s1.liked) AS "matchesCount"
      FROM "MobileProfiles" p
      JOIN "Participants" pa ON pa.uuid = p."participantUuid"
      WHERE p."eventUuid" = ${eventUuid}::uuid
        AND (${participantUuid}::uuid IS NULL OR p."participantUuid" = ${participantUuid}::uuid)`;

    const people = rows.map((row) => ({
      ...toPerson(row, row.participantUuid),
      email: row.email,
      tinderOptIn: row.tinderOptIn,
      likesGiven: Number(row.likesGiven),
      passesGiven: Number(row.passesGiven),
      likesReceived: Number(row.likesReceived),
      matchesCount: Number(row.matchesCount),
    }));
    // Most active first: matches, then swipes made
    return people.toSorted(
      (a, b) =>
        b.matchesCount - a.matchesCount ||
        b.likesGiven + b.passesGiven - (a.likesGiven + a.passesGiven) ||
        a.displayName.localeCompare(b.displayName, "pl"),
    );
  }

  /** Tell the other person about the match (they were not the one swiping now). */
  private notifyMatch(
    me: ParticipantContext,
    otherUuid: string,
    roomUuid: string,
  ): void {
    this.mobilePushService.run("tinder match", async () => {
      const [{ event }, profile] = await Promise.all([
        this.mobileEventService.getByUuid(me.eventUuid),
        this.prisma.mobileProfile.findUnique({
          where: { participantUuid: me.uuid },
          select: { displayName: true },
        }),
      ]);
      const name = toPerson(profile, me.uuid).displayName;
      this.mobilePushService.sendToParticipants([otherUuid], {
        title: "To match! 🎉",
        body: `${name} też Cię polubił(a). Napisz pierwszy!`,
        url: `/${event.slug}/app/chats/${roomUuid}`,
        tag: `match-${roomUuid}`,
      });
    });
  }

  private async ensureDirectRoom(
    eventUuid: string,
    a: string,
    b: string,
  ): Promise<string> {
    const key = directRoomKey(a, b);
    await this.prisma.mobileChatRoom.createMany({
      data: [{ eventUuid, key, type: "DIRECT" }],
      skipDuplicates: true,
    });
    const room = await this.prisma.mobileChatRoom.findUniqueOrThrow({
      where: { eventUuid_key: { eventUuid, key } },
      select: { uuid: true },
    });
    await this.prisma.mobileChatMember.createMany({
      data: [
        { roomUuid: room.uuid, participantUuid: a },
        { roomUuid: room.uuid, participantUuid: b },
      ],
      skipDuplicates: true,
    });
    return room.uuid;
  }

  private async assertHasProfile(me: ParticipantContext): Promise<void> {
    const profile = await this.prisma.mobileProfile.findUnique({
      where: { participantUuid: me.uuid },
      select: { tinderOptIn: true },
    });
    if (profile === null) {
      throw new ForbiddenException("Complete your profile first");
    }
    // Swiping while hidden from everyone else would be one-sided
    if (!profile.tinderOptIn) {
      throw new ForbiddenException("Join Tinderownik first");
    }
  }
}
