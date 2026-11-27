import { createHash } from "node:crypto";
import { PrismaService } from "src/prisma/prisma.service";

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import type { ParticipantContext } from "../auth/current-participant.decorator";
import { MobileEventService } from "../common/mobile-event.service";
import { MobileImageService } from "../common/mobile-image.service";
import { toPerson } from "../common/mobile-person";
import type { UpdateBingoTaskDto } from "./dto/social.dto";
import { loadProfiles } from "./social-utils";
import type {
  MobileBingoBoardDto,
  MobileBingoLeaderboardEntryDto,
  MobileBingoStatus,
  MobileBingoTaskAdminDto,
} from "./social.types";

const DEFAULT_SIZE = 4;
const LEADERBOARD_SIZE = 20;

function shuffleKey(participantUuid: string, taskUuid: string): string {
  return createHash("sha256")
    .update(participantUuid + taskUuid)
    .digest("hex");
}

function countLines(completed: boolean[], size: number): number {
  let lines = 0;
  for (let index = 0; index < size; index++) {
    let row = true;
    let column = true;
    for (let offset = 0; offset < size; offset++) {
      row &&= completed[index * size + offset];
      column &&= completed[offset * size + index];
    }
    lines += Number(row) + Number(column);
  }
  let diagonal = true;
  let antiDiagonal = true;
  for (let index = 0; index < size; index++) {
    diagonal &&= completed[index * size + index];
    antiDiagonal &&= completed[index * size + (size - 1 - index)];
  }
  return lines + Number(diagonal) + Number(antiDiagonal);
}

const MAX_NOTE_LENGTH = 300;

/** The organizer's time window for bingo and where "now" falls in it */
function bingoWindow(
  app: { bingoStartsAt: Date | null; bingoEndsAt: Date | null } | null,
): Pick<MobileBingoBoardDto, "startsAt" | "endsAt" | "status"> {
  const startsAt = app?.bingoStartsAt ?? null;
  const endsAt = app?.bingoEndsAt ?? null;
  const now = Date.now();
  const status: MobileBingoStatus =
    startsAt !== null && now < startsAt.getTime()
      ? "upcoming"
      : endsAt !== null && now >= endsAt.getTime()
        ? "ended"
        : "active";
  return {
    startsAt: startsAt?.toISOString() ?? null,
    endsAt: endsAt?.toISOString() ?? null,
    status,
  };
}

@Injectable()
export class MobileBingoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mobileEventService: MobileEventService,
    private readonly mobileImageService: MobileImageService,
  ) {}

  // -------------------------------------------------------------------------
  // Participant
  // -------------------------------------------------------------------------

  async board(me: ParticipantContext): Promise<MobileBingoBoardDto> {
    const [snapshot, tasks] = await Promise.all([
      this.mobileEventService.getByUuid(me.eventUuid),
      this.prisma.mobileBingoTask.findMany({
        where: { eventUuid: me.eventUuid },
        select: { uuid: true, text: true },
      }),
    ]);
    const size = snapshot.app?.bingoSize ?? DEFAULT_SIZE;
    const timeWindow = bingoWindow(snapshot.app);
    const cellCount = size * size;
    if (tasks.length < cellCount) {
      return {
        size,
        cells: [],
        completedCount: 0,
        bingoLines: 0,
        hasBingo: false,
        ...timeWindow,
      };
    }

    const boardTasks = tasks
      .map((task) => ({ ...task, key: shuffleKey(me.uuid, task.uuid) }))
      .toSorted((a, b) => a.key.localeCompare(b.key))
      .slice(0, cellCount);

    const completions = await this.prisma.mobileBingoCompletion.findMany({
      where: {
        participantUuid: me.uuid,
        taskUuid: { in: boardTasks.map((task) => task.uuid) },
      },
      select: { taskUuid: true, photoKey: true, note: true, createdAt: true },
    });
    const byTask = new Map(
      completions.map((completion) => [completion.taskUuid, completion]),
    );

    const cells = boardTasks.map((task) => {
      const completion = byTask.get(task.uuid);
      return {
        taskUuid: task.uuid,
        text: task.text,
        completed: completion !== undefined,
        photoUrl: this.mobileImageService.url(completion?.photoKey ?? null),
        note: completion?.note ?? null,
        completedAt: completion?.createdAt.toISOString() ?? null,
      };
    });
    const bingoLines = countLines(
      cells.map((cell) => cell.completed),
      size,
    );
    return {
      size,
      cells,
      completedCount: completions.length,
      bingoLines,
      hasBingo: bingoLines > 0,
      ...timeWindow,
    };
  }

  async complete(
    me: ParticipantContext,
    taskUuid: string,
    photo: Express.Multer.File | undefined,
    rawNote?: unknown,
  ): Promise<MobileBingoBoardDto> {
    await this.assertActive(me.eventUuid);
    await this.assertTaskOnBoard(me, taskUuid);
    // undefined = the field was not sent, so an existing note is kept
    const note =
      typeof rawNote === "string"
        ? rawNote.trim().slice(0, MAX_NOTE_LENGTH) || null
        : undefined;
    const photoKey =
      photo === undefined ? null : await this.mobileImageService.upload(photo);

    const existing = await this.prisma.mobileBingoCompletion.findUnique({
      where: {
        taskUuid_participantUuid: { taskUuid, participantUuid: me.uuid },
      },
      select: { photoKey: true },
    });

    await this.prisma.mobileBingoCompletion.upsert({
      where: {
        taskUuid_participantUuid: { taskUuid, participantUuid: me.uuid },
      },
      create: { taskUuid, participantUuid: me.uuid, photoKey, note },
      update: {
        ...(photoKey === null ? {} : { photoKey }),
        ...(note === undefined ? {} : { note }),
      },
    });

    if (
      photoKey !== null &&
      existing?.photoKey !== null &&
      existing?.photoKey !== undefined
    ) {
      await this.safeDelete(existing.photoKey);
    }
    return this.board(me);
  }

  async uncomplete(
    me: ParticipantContext,
    taskUuid: string,
  ): Promise<MobileBingoBoardDto> {
    await this.assertActive(me.eventUuid);
    await this.assertTaskInEvent(taskUuid, me.eventUuid);
    const existing = await this.prisma.mobileBingoCompletion.findUnique({
      where: {
        taskUuid_participantUuid: { taskUuid, participantUuid: me.uuid },
      },
      select: { uuid: true, photoKey: true },
    });
    if (existing !== null) {
      await this.prisma.mobileBingoCompletion.deleteMany({
        where: { uuid: existing.uuid },
      });
      await this.safeDelete(existing.photoKey);
    }
    return this.board(me);
  }

  async leaderboard(
    me: ParticipantContext,
  ): Promise<MobileBingoLeaderboardEntryDto[]> {
    const rows = await this.prisma.$queryRaw<
      { participantUuid: string; count: bigint | number }[]
    >`
      SELECT c."participantUuid"::text AS "participantUuid", COUNT(*) AS count
      FROM "MobileBingoCompletions" c
      JOIN "MobileBingoTasks" t ON t.uuid = c."taskUuid"
      WHERE t."eventUuid" = ${me.eventUuid}::uuid
      GROUP BY c."participantUuid"
      ORDER BY count DESC, MIN(c."createdAt") ASC
      LIMIT ${LEADERBOARD_SIZE}`;
    const profiles = await loadProfiles(
      this.prisma,
      rows.map((row) => row.participantUuid),
    );
    return rows.map((row) => ({
      ...toPerson(profiles.get(row.participantUuid), row.participantUuid),
      completedCount: Number(row.count),
    }));
  }

  // -------------------------------------------------------------------------
  // Organizer
  // -------------------------------------------------------------------------

  async listTasks(eventUuid: string): Promise<MobileBingoTaskAdminDto[]> {
    const tasks = await this.prisma.mobileBingoTask.findMany({
      where: { eventUuid },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        uuid: true,
        text: true,
        order: true,
        _count: { select: { completions: true } },
      },
    });
    return tasks.map((task) => ({
      uuid: task.uuid,
      text: task.text,
      order: task.order,
      completionsCount: task._count.completions,
    }));
  }

  async createTask(
    eventUuid: string,
    text: string,
  ): Promise<MobileBingoTaskAdminDto> {
    const order = await this.nextOrder(eventUuid);
    const task = await this.prisma.mobileBingoTask.create({
      data: { eventUuid, text, order },
      select: { uuid: true, text: true, order: true },
    });
    return { ...task, completionsCount: 0 };
  }

  async createTasks(
    eventUuid: string,
    texts: string[],
  ): Promise<MobileBingoTaskAdminDto[]> {
    const start = await this.nextOrder(eventUuid);
    await this.prisma.mobileBingoTask.createMany({
      data: texts.map((text, index) => ({
        eventUuid,
        text,
        order: start + index,
      })),
    });
    return this.listTasks(eventUuid);
  }

  async updateTask(
    eventUuid: string,
    taskUuid: string,
    dto: UpdateBingoTaskDto,
  ): Promise<MobileBingoTaskAdminDto> {
    await this.assertTaskInEvent(taskUuid, eventUuid);
    const task = await this.prisma.mobileBingoTask.update({
      where: { uuid: taskUuid },
      data: { text: dto.text, order: dto.order },
      select: {
        uuid: true,
        text: true,
        order: true,
        _count: { select: { completions: true } },
      },
    });
    return {
      uuid: task.uuid,
      text: task.text,
      order: task.order,
      completionsCount: task._count.completions,
    };
  }

  async deleteTask(eventUuid: string, taskUuid: string): Promise<void> {
    await this.assertTaskInEvent(taskUuid, eventUuid);
    const photos = await this.prisma.mobileBingoCompletion.findMany({
      where: { taskUuid, photoKey: { not: null } },
      select: { photoKey: true },
    });
    await this.prisma.mobileBingoTask.delete({ where: { uuid: taskUuid } });
    await Promise.all(photos.map(async (row) => this.safeDelete(row.photoKey)));
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async nextOrder(eventUuid: string): Promise<number> {
    const aggregate = await this.prisma.mobileBingoTask.aggregate({
      where: { eventUuid },
      _max: { order: true },
    });
    return (aggregate._max.order ?? -1) + 1;
  }

  /** Ticking and unticking are allowed only inside the organizer's time window */
  private async assertActive(eventUuid: string): Promise<void> {
    const snapshot = await this.mobileEventService.getByUuid(eventUuid);
    if (bingoWindow(snapshot.app).status !== "active") {
      throw new ForbiddenException("Bingo is not active right now");
    }
  }

  /** Only tasks on the participant's own board can be ticked, so the ranking cannot be inflated */
  private async assertTaskOnBoard(
    me: ParticipantContext,
    taskUuid: string,
  ): Promise<void> {
    const [snapshot, tasks] = await Promise.all([
      this.mobileEventService.getByUuid(me.eventUuid),
      this.prisma.mobileBingoTask.findMany({
        where: { eventUuid: me.eventUuid },
        select: { uuid: true },
      }),
    ]);
    const size = snapshot.app?.bingoSize ?? DEFAULT_SIZE;
    const cellCount = size * size;
    const onBoard =
      tasks.length >= cellCount &&
      tasks
        .map((task) => ({
          uuid: task.uuid,
          key: shuffleKey(me.uuid, task.uuid),
        }))
        .toSorted((a, b) => a.key.localeCompare(b.key))
        .slice(0, cellCount)
        .some((task) => task.uuid === taskUuid);
    if (!onBoard) {
      throw new NotFoundException("Task not found");
    }
  }

  private async assertTaskInEvent(
    taskUuid: string,
    eventUuid: string,
  ): Promise<void> {
    const task = await this.prisma.mobileBingoTask.findUnique({
      where: { uuid: taskUuid },
      select: { eventUuid: true },
    });
    if (task?.eventUuid !== eventUuid) {
      throw new NotFoundException("Task not found");
    }
  }

  private async safeDelete(key: string | null): Promise<void> {
    try {
      await this.mobileImageService.delete(key);
    } catch {
      // the row is gone; a leftover object in storage is harmless
    }
  }
}
