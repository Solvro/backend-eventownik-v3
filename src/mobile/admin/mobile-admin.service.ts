import { PrismaService } from "src/prisma/prisma.service";

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { MobileEventService } from "../common/mobile-event.service";
import type {
  CreateMobileFaqItemDto,
  CreateMobileNotificationDto,
  CreateMobileScheduleItemDto,
  CreateMobileSosContactDto,
  MobileAppConfigDto,
  UpdateMobileFaqItemDto,
  UpdateMobileScheduleItemDto,
  UpdateMobileSosContactDto,
} from "../dto/admin.dto";
import {
  MOBILE_FAQ_SELECT,
  MOBILE_NOTIFICATION_SELECT,
  MOBILE_SCHEDULE_SELECT,
  MOBILE_SOS_CONTACT_SELECT,
} from "../participant/mobile-participant.service";
import { MobilePushService } from "../push/mobile-push.service";

export interface MobileAppConfigView {
  isEnabled: boolean;
  welcomeMessage: string | null;
  accentColor: string | null;
  sosEnabled: boolean;
  scheduleEnabled: boolean;
  chatEnabled: boolean;
  tinderEnabled: boolean;
  bingoEnabled: boolean;
  berealEnabled: boolean;
  soundboardEnabled: boolean;
  bingoSize: number;
  bingoStartsAt: Date | null;
  bingoEndsAt: Date | null;
  profilesCount: number;
}

const CONFIG_SELECT = {
  isEnabled: true,
  welcomeMessage: true,
  accentColor: true,
  sosEnabled: true,
  scheduleEnabled: true,
  chatEnabled: true,
  tinderEnabled: true,
  bingoEnabled: true,
  berealEnabled: true,
  soundboardEnabled: true,
  bingoSize: true,
  bingoStartsAt: true,
  bingoEndsAt: true,
} as const;

/** undefined = leave unchanged, null = clear */
function toDate(value: string | null | undefined): Date | null | undefined {
  return value === undefined || value === null ? value : new Date(value);
}

/** `null` is accepted by @IsOptional, but these columns are not nullable. */
function nonNull<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

@Injectable()
export class MobileAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mobileEventService: MobileEventService,
    private readonly mobilePushService: MobilePushService,
  ) {}

  // -------------------------------------------------------------------------
  // Config
  // -------------------------------------------------------------------------

  async getConfig(eventUuid: string): Promise<MobileAppConfigView> {
    await this.assertEvent(eventUuid);
    const app = await this.prisma.mobileApp.upsert({
      where: { eventUuid },
      create: { eventUuid },
      update: {},
      select: CONFIG_SELECT,
    });
    return { ...app, profilesCount: await this.countProfiles(eventUuid) };
  }

  async updateConfig(
    eventUuid: string,
    dto: MobileAppConfigDto,
  ): Promise<MobileAppConfigView> {
    await this.assertEvent(eventUuid);
    const data = {
      isEnabled: nonNull(dto.isEnabled),
      welcomeMessage: dto.welcomeMessage,
      accentColor: dto.accentColor,
      sosEnabled: nonNull(dto.sosEnabled),
      scheduleEnabled: nonNull(dto.scheduleEnabled),
      chatEnabled: nonNull(dto.chatEnabled),
      tinderEnabled: nonNull(dto.tinderEnabled),
      bingoEnabled: nonNull(dto.bingoEnabled),
      berealEnabled: nonNull(dto.berealEnabled),
      soundboardEnabled: nonNull(dto.soundboardEnabled),
      bingoSize: nonNull(dto.bingoSize),
      bingoStartsAt: toDate(dto.bingoStartsAt),
      bingoEndsAt: toDate(dto.bingoEndsAt),
    };
    if (
      data.bingoStartsAt instanceof Date &&
      data.bingoEndsAt instanceof Date &&
      data.bingoEndsAt <= data.bingoStartsAt
    ) {
      throw new BadRequestException("Bingo must end after it starts");
    }
    const app = await this.prisma.mobileApp.upsert({
      where: { eventUuid },
      create: { eventUuid, ...data },
      update: data,
      select: CONFIG_SELECT,
    });
    this.mobileEventService.invalidate(eventUuid);
    return { ...app, profilesCount: await this.countProfiles(eventUuid) };
  }

  // -------------------------------------------------------------------------
  // SOS contacts
  // -------------------------------------------------------------------------

  async listSosContacts(eventUuid: string) {
    await this.assertEvent(eventUuid);
    return this.prisma.mobileSosContact.findMany({
      where: { eventUuid },
      select: MOBILE_SOS_CONTACT_SELECT,
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
  }

  async createSosContact(eventUuid: string, dto: CreateMobileSosContactDto) {
    await this.assertEvent(eventUuid);
    return this.prisma.mobileSosContact.create({
      data: {
        eventUuid,
        label: dto.label,
        phone: dto.phone,
        description: dto.description ?? null,
        order: nonNull(dto.order),
      },
      select: MOBILE_SOS_CONTACT_SELECT,
    });
  }

  async updateSosContact(
    eventUuid: string,
    uuid: string,
    dto: UpdateMobileSosContactDto,
  ) {
    await this.assertOwned(
      this.prisma.mobileSosContact.findFirst({
        where: { uuid, eventUuid },
        select: { uuid: true },
      }),
      "SOS contact",
    );
    return this.prisma.mobileSosContact.update({
      where: { uuid },
      data: {
        label: nonNull(dto.label),
        phone: nonNull(dto.phone),
        description: dto.description,
        order: nonNull(dto.order),
      },
      select: MOBILE_SOS_CONTACT_SELECT,
    });
  }

  async deleteSosContact(eventUuid: string, uuid: string): Promise<void> {
    const { count } = await this.prisma.mobileSosContact.deleteMany({
      where: { uuid, eventUuid },
    });
    if (count === 0) {
      throw new NotFoundException("SOS contact not found");
    }
  }

  // -------------------------------------------------------------------------
  // FAQ
  // -------------------------------------------------------------------------

  async listFaq(eventUuid: string) {
    await this.assertEvent(eventUuid);
    return this.prisma.mobileFaqItem.findMany({
      where: { eventUuid },
      select: MOBILE_FAQ_SELECT,
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
  }

  async createFaq(eventUuid: string, dto: CreateMobileFaqItemDto) {
    await this.assertEvent(eventUuid);
    return this.prisma.mobileFaqItem.create({
      data: {
        eventUuid,
        question: dto.question,
        answer: dto.answer,
        order: nonNull(dto.order),
      },
      select: MOBILE_FAQ_SELECT,
    });
  }

  async updateFaq(
    eventUuid: string,
    uuid: string,
    dto: UpdateMobileFaqItemDto,
  ) {
    await this.assertOwned(
      this.prisma.mobileFaqItem.findFirst({
        where: { uuid, eventUuid },
        select: { uuid: true },
      }),
      "FAQ item",
    );
    return this.prisma.mobileFaqItem.update({
      where: { uuid },
      data: {
        question: nonNull(dto.question),
        answer: nonNull(dto.answer),
        order: nonNull(dto.order),
      },
      select: MOBILE_FAQ_SELECT,
    });
  }

  async deleteFaq(eventUuid: string, uuid: string): Promise<void> {
    const { count } = await this.prisma.mobileFaqItem.deleteMany({
      where: { uuid, eventUuid },
    });
    if (count === 0) {
      throw new NotFoundException("FAQ item not found");
    }
  }

  // -------------------------------------------------------------------------
  // Schedule
  // -------------------------------------------------------------------------

  async listSchedule(eventUuid: string) {
    await this.assertEvent(eventUuid);
    return this.prisma.mobileScheduleItem.findMany({
      where: { eventUuid },
      select: MOBILE_SCHEDULE_SELECT,
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    });
  }

  async createSchedule(eventUuid: string, dto: CreateMobileScheduleItemDto) {
    await this.assertEvent(eventUuid);
    const startsAt = new Date(dto.startsAt);
    const endsAt =
      dto.endsAt === undefined || dto.endsAt === null
        ? null
        : new Date(dto.endsAt);
    this.assertRange(startsAt, endsAt);
    return this.prisma.mobileScheduleItem.create({
      data: {
        eventUuid,
        title: dto.title,
        description: dto.description ?? null,
        location: dto.location ?? null,
        startsAt,
        endsAt,
      },
      select: MOBILE_SCHEDULE_SELECT,
    });
  }

  async updateSchedule(
    eventUuid: string,
    uuid: string,
    dto: UpdateMobileScheduleItemDto,
  ) {
    const existing = await this.assertOwned(
      this.prisma.mobileScheduleItem.findFirst({
        where: { uuid, eventUuid },
        select: { startsAt: true, endsAt: true },
      }),
      "Schedule item",
    );
    // @IsOptional lets null through at runtime; startsAt is not nullable
    const rawStartsAt = dto.startsAt as string | null | undefined;
    const startsAt =
      rawStartsAt === undefined || rawStartsAt === null
        ? undefined
        : new Date(rawStartsAt);
    const endsAt =
      dto.endsAt === undefined
        ? undefined
        : dto.endsAt === null
          ? null
          : new Date(dto.endsAt);
    this.assertRange(
      startsAt ?? existing.startsAt,
      endsAt === undefined ? existing.endsAt : endsAt,
    );
    return this.prisma.mobileScheduleItem.update({
      where: { uuid },
      data: {
        title: nonNull(dto.title),
        description: dto.description,
        location: dto.location,
        startsAt,
        endsAt,
      },
      select: MOBILE_SCHEDULE_SELECT,
    });
  }

  async deleteSchedule(eventUuid: string, uuid: string): Promise<void> {
    const { count } = await this.prisma.mobileScheduleItem.deleteMany({
      where: { uuid, eventUuid },
    });
    if (count === 0) {
      throw new NotFoundException("Schedule item not found");
    }
  }

  // -------------------------------------------------------------------------
  // Notifications
  // -------------------------------------------------------------------------

  async listNotifications(eventUuid: string) {
    await this.assertEvent(eventUuid);
    return this.prisma.mobileNotification.findMany({
      where: { eventUuid },
      select: MOBILE_NOTIFICATION_SELECT,
      orderBy: { seq: "desc" },
    });
  }

  async createNotification(
    eventUuid: string,
    adminUuid: string,
    dto: CreateMobileNotificationDto,
  ) {
    await this.assertEvent(eventUuid);
    const notification = await this.prisma.mobileNotification.create({
      data: {
        eventUuid,
        title: dto.title,
        body: dto.body,
        createdByAdminUuid: adminUuid,
      },
      select: MOBILE_NOTIFICATION_SELECT,
    });
    this.mobilePushService.run("announcement", async () => {
      const { event } = await this.mobileEventService.getByUuid(eventUuid);
      this.mobilePushService.sendToEvent(eventUuid, {
        title: dto.title,
        body: dto.body,
        url: `/${event.slug}/app`,
      });
    });
    return notification;
  }

  async deleteNotification(eventUuid: string, uuid: string): Promise<void> {
    const { count } = await this.prisma.mobileNotification.deleteMany({
      where: { uuid, eventUuid },
    });
    if (count === 0) {
      throw new NotFoundException("Notification not found");
    }
  }

  // -------------------------------------------------------------------------

  private async assertEvent(eventUuid: string): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { uuid: eventUuid },
      select: { uuid: true },
    });
    if (event === null) {
      throw new NotFoundException("Event not found");
    }
  }

  private async assertOwned<T>(query: Promise<T | null>, what: string) {
    const row = await query;
    if (row === null) {
      throw new NotFoundException(`${what} not found`);
    }
    return row;
  }

  private assertRange(startsAt: Date, endsAt: Date | null): void {
    if (endsAt !== null && endsAt < startsAt) {
      throw new BadRequestException("endsAt must not be before startsAt");
    }
  }

  private async countProfiles(eventUuid: string): Promise<number> {
    return this.prisma.mobileProfile.count({ where: { eventUuid } });
  }
}
