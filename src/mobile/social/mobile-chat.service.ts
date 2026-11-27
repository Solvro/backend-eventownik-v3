import { Prisma } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import type { ParticipantContext } from "../auth/current-participant.decorator";
import { MobileEventService } from "../common/mobile-event.service";
import { MobileImageService } from "../common/mobile-image.service";
import { MOBILE_DEFAULT_DISPLAY_NAME, toPerson } from "../common/mobile-person";
import type { ChatMessagesQueryDto } from "./dto/social.dto";
import type { ProfileLite } from "./social-utils";
import { isUniqueViolation, loadProfiles, otherFromKey } from "./social-utils";
import type { MobileChatMessageDto, MobileChatRoomDto } from "./social.types";

const EVENT_ROOM_KEY = "EVENT";
const ORGANIZER_NAME = "Organizator";
const DEFAULT_LIMIT = 50;
const FLOOD_WINDOW_MS = 30_000;
const FLOOD_MAX_MESSAGES = 20;

const MESSAGE_SELECT = {
  uuid: true,
  seq: true,
  body: true,
  createdAt: true,
  senderParticipantUuid: true,
  senderAdminUuid: true,
} as const;

type MessageRow = Prisma.MobileChatMessageGetPayload<{
  select: typeof MESSAGE_SELECT;
}>;

interface RoomAccess {
  uuid: string;
  type: "EVENT" | "DIRECT";
  lastReadSeq: number;
  isMember: boolean;
}

/** Unread badges show at most this many; the client renders it as "99+" */
const UNREAD_COUNT_CAP = 100;

@Injectable()
export class MobileChatService {
  /** eventUuid -> event room uuid */
  private readonly eventRooms = new Map<string, string>();
  /** participantUuid -> timestamps of recent messages (flood guard) */
  private readonly recentSends = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mobileEventService: MobileEventService,
    private readonly mobileImageService: MobileImageService,
  ) {}

  async ensureEventRoom(eventUuid: string): Promise<string> {
    const cached = this.eventRooms.get(eventUuid);
    if (cached !== undefined) {
      return cached;
    }
    let roomUuid: string;
    try {
      const room = await this.prisma.mobileChatRoom.upsert({
        where: { eventUuid_key: { eventUuid, key: EVENT_ROOM_KEY } },
        create: { eventUuid, key: EVENT_ROOM_KEY, type: "EVENT" },
        update: {},
        select: { uuid: true },
      });
      roomUuid = room.uuid;
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      const room = await this.prisma.mobileChatRoom.findUniqueOrThrow({
        where: { eventUuid_key: { eventUuid, key: EVENT_ROOM_KEY } },
        select: { uuid: true },
      });
      roomUuid = room.uuid;
    }
    if (this.eventRooms.size > 5000) {
      this.eventRooms.clear();
    }
    this.eventRooms.set(eventUuid, roomUuid);
    return roomUuid;
  }

  // -------------------------------------------------------------------------
  // Participant
  // -------------------------------------------------------------------------

  async listRooms(me: ParticipantContext): Promise<MobileChatRoomDto[]> {
    const eventRoomUuid = await this.ensureEventRoom(me.eventUuid);

    const memberships = await this.prisma.mobileChatMember.findMany({
      where: { participantUuid: me.uuid, room: { eventUuid: me.eventUuid } },
      select: {
        lastReadSeq: true,
        room: {
          select: { uuid: true, type: true, key: true, createdAt: true },
        },
      },
    });

    const lastRead = new Map<string, number>([[eventRoomUuid, 0]]);
    const directRooms: {
      uuid: string;
      other: string | null;
      createdAt: Date;
    }[] = [];
    for (const membership of memberships) {
      lastRead.set(membership.room.uuid, membership.lastReadSeq);
      if (membership.room.type === "DIRECT") {
        directRooms.push({
          uuid: membership.room.uuid,
          other: otherFromKey(membership.room.key, me.uuid),
          createdAt: membership.room.createdAt,
        });
      }
    }

    const roomUuids = [...lastRead.keys()];
    const lastSeqs = roomUuids.map((uuid) => lastRead.get(uuid) ?? 0);

    const [unreadRows, lastRows, snapshot] = await Promise.all([
      this.prisma.$queryRaw<{ roomUuid: string; count: bigint | number }[]>`
        SELECT r.room_uuid::text AS "roomUuid", u.count
        FROM unnest(${roomUuids}::uuid[], ${lastSeqs}::int[]) AS r(room_uuid, last_seq)
        CROSS JOIN LATERAL (
          -- Capped, so the cost does not grow with the size of a busy room
          SELECT COUNT(*) AS count FROM (
            SELECT 1
            FROM "MobileChatMessages" m
            WHERE m."roomUuid" = r.room_uuid
              AND m.seq > r.last_seq
              AND m."deletedAt" IS NULL
              AND (m."senderParticipantUuid" IS NULL OR m."senderParticipantUuid" <> ${me.uuid}::uuid)
            LIMIT ${UNREAD_COUNT_CAP}
          ) capped
        ) u
        WHERE u.count > 0`,
      this.prisma.$queryRaw<
        {
          roomUuid: string;
          body: string;
          createdAt: Date;
          senderParticipantUuid: string | null;
          senderAdminUuid: string | null;
        }[]
      >`
        SELECT DISTINCT ON (m."roomUuid")
          m."roomUuid"::text AS "roomUuid", m.body, m."createdAt",
          m."senderParticipantUuid"::text AS "senderParticipantUuid",
          m."senderAdminUuid"::text AS "senderAdminUuid"
        FROM "MobileChatMessages" m
        WHERE m."roomUuid" = ANY(${roomUuids}::uuid[]) AND m."deletedAt" IS NULL
        ORDER BY m."roomUuid", m.seq DESC`,
      this.mobileEventService.getByUuid(me.eventUuid),
    ]);

    const unread = new Map(
      unreadRows.map((row) => [row.roomUuid, Number(row.count)]),
    );
    const last = new Map(lastRows.map((row) => [row.roomUuid, row]));

    const profileUuids: string[] = [];
    for (const room of directRooms) {
      if (room.other !== null) {
        profileUuids.push(room.other);
      }
    }
    for (const row of lastRows) {
      if (row.senderParticipantUuid !== null) {
        profileUuids.push(row.senderParticipantUuid);
      }
    }
    const profiles = await loadProfiles(this.prisma, profileUuids);

    const lastMessageOf = (
      roomUuid: string,
    ): MobileChatRoomDto["lastMessage"] => {
      const row = last.get(roomUuid);
      if (row === undefined) {
        return null;
      }
      return {
        body: row.body,
        createdAt: row.createdAt.toISOString(),
        senderName: this.senderName(row, profiles),
      };
    };

    const eventRoom: MobileChatRoomDto = {
      uuid: eventRoomUuid,
      type: "EVENT",
      title: snapshot.event.name,
      photoUrl: this.mobileImageService.url(snapshot.event.photoKey),
      lastMessage: lastMessageOf(eventRoomUuid),
      unreadCount: unread.get(eventRoomUuid) ?? 0,
    };

    const direct = directRooms
      .map((room) => {
        const person = toPerson(
          room.other === null ? null : profiles.get(room.other),
          room.other ?? "",
        );
        const lastMessage = lastMessageOf(room.uuid);
        return {
          sortAt:
            last.get(room.uuid)?.createdAt.getTime() ??
            room.createdAt.getTime(),
          dto: {
            uuid: room.uuid,
            type: "DIRECT",
            title: person.displayName,
            photoUrl: person.photoUrl,
            lastMessage,
            unreadCount: unread.get(room.uuid) ?? 0,
          } satisfies MobileChatRoomDto,
        };
      })
      .toSorted((a, b) => b.sortAt - a.sortAt)
      .map((entry) => entry.dto);

    return [eventRoom, ...direct];
  }

  async listMessages(
    me: ParticipantContext,
    roomUuid: string,
    query: ChatMessagesQueryDto,
  ): Promise<MobileChatMessageDto[]> {
    const access = await this.getAccess(me, roomUuid);
    const messages = await this.fetchMessages(access.uuid, query);

    const newest = messages.at(-1)?.seq;
    if (newest !== undefined && newest > access.lastReadSeq) {
      // Only ever move the read position forward: a slow older request must not undo a newer one
      await this.prisma.$executeRaw`
        INSERT INTO "MobileChatMembers" ("uuid", "roomUuid", "participantUuid", "lastReadSeq")
        VALUES (gen_random_uuid(), ${access.uuid}::uuid, ${me.uuid}::uuid, ${newest})
        ON CONFLICT ("roomUuid", "participantUuid")
        DO UPDATE SET "lastReadSeq" = GREATEST("MobileChatMembers"."lastReadSeq", EXCLUDED."lastReadSeq")`;
    }

    return this.toMessages(messages, me.uuid);
  }

  async sendMessage(
    me: ParticipantContext,
    roomUuid: string,
    body: string,
  ): Promise<MobileChatMessageDto> {
    const access = await this.getAccess(me, roomUuid);
    this.assertNotFlooding(me.uuid);

    const message = await this.prisma.mobileChatMessage.create({
      data: {
        roomUuid: access.uuid,
        senderParticipantUuid: me.uuid,
        body: body.trim(),
      },
      select: MESSAGE_SELECT,
    });
    const [dto] = await this.toMessages([message], me.uuid);
    return dto;
  }

  // -------------------------------------------------------------------------
  // Organizer
  // -------------------------------------------------------------------------

  async adminListMessages(
    eventUuid: string,
    query: ChatMessagesQueryDto,
  ): Promise<MobileChatMessageDto[]> {
    const roomUuid = await this.ensureEventRoom(eventUuid);
    const messages = await this.fetchMessages(roomUuid, query);
    return this.toMessages(messages, null);
  }

  async adminSendMessage(
    eventUuid: string,
    adminUuid: string,
    body: string,
  ): Promise<MobileChatMessageDto> {
    const roomUuid = await this.ensureEventRoom(eventUuid);
    const message = await this.prisma.mobileChatMessage.create({
      data: { roomUuid, senderAdminUuid: adminUuid, body: body.trim() },
      select: MESSAGE_SELECT,
    });
    const [dto] = await this.toMessages([message], null);
    return dto;
  }

  async adminDeleteMessage(
    eventUuid: string,
    messageUuid: string,
  ): Promise<void> {
    const result = await this.prisma.mobileChatMessage.updateMany({
      where: { uuid: messageUuid, room: { eventUuid } },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException("Message not found");
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async getAccess(
    me: ParticipantContext,
    roomUuid: string,
  ): Promise<RoomAccess> {
    const room = await this.prisma.mobileChatRoom.findUnique({
      where: { uuid: roomUuid },
      select: {
        uuid: true,
        type: true,
        eventUuid: true,
        members: {
          where: { participantUuid: me.uuid },
          select: { lastReadSeq: true },
        },
      },
    });
    if (room?.eventUuid !== me.eventUuid) {
      throw new NotFoundException("Room not found");
    }
    const member = room.members.at(0);
    if (room.type === "DIRECT" && member === undefined) {
      throw new NotFoundException("Room not found");
    }
    return {
      uuid: room.uuid,
      type: room.type,
      lastReadSeq: member?.lastReadSeq ?? 0,
      isMember: member !== undefined,
    };
  }

  private async fetchMessages(
    roomUuid: string,
    query: ChatMessagesQueryDto,
  ): Promise<MessageRow[]> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const { afterSeq, beforeSeq } = query;

    if (afterSeq !== undefined) {
      return this.prisma.mobileChatMessage.findMany({
        where: {
          roomUuid,
          deletedAt: null,
          seq: {
            gt: afterSeq,
            ...(beforeSeq === undefined ? {} : { lt: beforeSeq }),
          },
        },
        orderBy: { seq: "asc" },
        take: limit,
        select: MESSAGE_SELECT,
      });
    }

    const rows = await this.prisma.mobileChatMessage.findMany({
      where: {
        roomUuid,
        deletedAt: null,
        ...(beforeSeq === undefined ? {} : { seq: { lt: beforeSeq } }),
      },
      orderBy: { seq: "desc" },
      take: limit,
      select: MESSAGE_SELECT,
    });
    return rows.toReversed();
  }

  private async toMessages(
    rows: MessageRow[],
    meUuid: string | null,
  ): Promise<MobileChatMessageDto[]> {
    const profiles = await loadProfiles(
      this.prisma,
      rows
        .map((row) => row.senderParticipantUuid)
        .filter((uuid): uuid is string => uuid !== null),
    );
    return rows.map((row) => ({
      uuid: row.uuid,
      seq: row.seq,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      sender:
        row.senderParticipantUuid === null
          ? null
          : toPerson(
              profiles.get(row.senderParticipantUuid),
              row.senderParticipantUuid,
            ),
      isOrganizer: row.senderAdminUuid !== null,
      isMine: meUuid !== null && row.senderParticipantUuid === meUuid,
    }));
  }

  private senderName(
    row: {
      senderParticipantUuid: string | null;
      senderAdminUuid: string | null;
    },
    profiles: Map<string, ProfileLite>,
  ): string | null {
    if (row.senderAdminUuid !== null) {
      return ORGANIZER_NAME;
    }
    if (row.senderParticipantUuid === null) {
      return null;
    }
    return (
      profiles.get(row.senderParticipantUuid)?.displayName ??
      MOBILE_DEFAULT_DISPLAY_NAME
    );
  }

  private assertNotFlooding(participantUuid: string): void {
    const now = Date.now();
    const recent = (this.recentSends.get(participantUuid) ?? []).filter(
      (timestamp) => now - timestamp < FLOOD_WINDOW_MS,
    );
    if (recent.length >= FLOOD_MAX_MESSAGES) {
      this.recentSends.set(participantUuid, recent);
      throw new HttpException(
        "Too many messages, slow down",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    if (this.recentSends.size > 50_000) {
      this.recentSends.clear();
    }
    this.recentSends.set(participantUuid, recent);
  }
}
