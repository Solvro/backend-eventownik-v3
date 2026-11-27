import { PrismaService } from "src/prisma/prisma.service";

import { BadRequestException, Injectable } from "@nestjs/common";

import type { ParticipantContext } from "../auth/current-participant.decorator";
import { MobileEventService } from "../common/mobile-event.service";
import { MobileImageService } from "../common/mobile-image.service";
import type { MobileMeView, MobileProfileView } from "../common/mobile-profile";
import { MOBILE_PROFILE_SELECT, toProfileView } from "../common/mobile-profile";
import type { MobileProfileDto } from "../dto/profile.dto";

export const MOBILE_NOTIFICATION_SELECT = {
  uuid: true,
  seq: true,
  title: true,
  body: true,
  createdAt: true,
} as const;

export const MOBILE_SCHEDULE_SELECT = {
  uuid: true,
  title: true,
  description: true,
  location: true,
  startsAt: true,
  endsAt: true,
} as const;

export const MOBILE_SOS_CONTACT_SELECT = {
  uuid: true,
  label: true,
  phone: true,
  description: true,
  order: true,
} as const;

export const MOBILE_FAQ_SELECT = {
  uuid: true,
  question: true,
  answer: true,
  order: true,
} as const;

@Injectable()
export class MobileParticipantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mobileEventService: MobileEventService,
    private readonly imageService: MobileImageService,
  ) {}

  async getMe(participant: ParticipantContext): Promise<MobileMeView> {
    const profile = await this.prisma.mobileProfile.findUnique({
      where: { participantUuid: participant.uuid },
      select: MOBILE_PROFILE_SELECT,
    });
    return {
      participant: { uuid: participant.uuid, email: participant.email },
      profile: toProfileView(profile),
    };
  }

  async updateProfile(
    participant: ParticipantContext,
    dto: MobileProfileDto,
  ): Promise<MobileProfileView> {
    const bio =
      dto.bio === undefined ? undefined : dto.bio === "" ? null : dto.bio;
    const profile = await this.prisma.mobileProfile.upsert({
      where: { participantUuid: participant.uuid },
      create: {
        participantUuid: participant.uuid,
        eventUuid: participant.eventUuid,
        displayName: dto.displayName,
        bio: bio ?? null,
        tinderOptIn: dto.tinderOptIn ?? true,
      },
      update: {
        displayName: dto.displayName,
        bio,
        tinderOptIn: dto.tinderOptIn,
      },
      select: MOBILE_PROFILE_SELECT,
    });
    return toProfileView(profile);
  }

  async updatePhoto(
    participant: ParticipantContext,
    file: Express.Multer.File | undefined,
  ): Promise<MobileProfileView> {
    const existing = await this.prisma.mobileProfile.findUnique({
      where: { participantUuid: participant.uuid },
      select: { photoKey: true },
    });
    if (existing === null) {
      throw new BadRequestException(
        "Set up the profile (PUT me/profile) before uploading a photo",
      );
    }

    const key = await this.imageService.upload(file);
    const profile = await this.prisma.mobileProfile
      .update({
        where: { participantUuid: participant.uuid },
        data: { photoKey: key },
        select: MOBILE_PROFILE_SELECT,
      })
      .catch(async (error: unknown) => {
        await this.imageService.delete(key);
        throw error;
      });
    if (existing.photoKey !== null && existing.photoKey !== key) {
      await this.imageService.delete(existing.photoKey);
    }
    return toProfileView(profile);
  }

  async getNotifications(eventUuid: string, afterSeq: number | undefined) {
    return this.prisma.mobileNotification.findMany({
      where: {
        eventUuid,
        ...(afterSeq === undefined ? {} : { seq: { gt: afterSeq } }),
      },
      select: MOBILE_NOTIFICATION_SELECT,
      orderBy: { seq: "desc" },
      take: 100,
    });
  }

  async getSchedule(eventUuid: string) {
    await this.mobileEventService.assertFeature(eventUuid, "schedule");
    return this.prisma.mobileScheduleItem.findMany({
      where: { eventUuid },
      select: MOBILE_SCHEDULE_SELECT,
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    });
  }

  async getSos(eventUuid: string) {
    await this.mobileEventService.assertFeature(eventUuid, "sos");
    const [contacts, faq] = await Promise.all([
      this.prisma.mobileSosContact.findMany({
        where: { eventUuid },
        select: MOBILE_SOS_CONTACT_SELECT,
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      }),
      this.prisma.mobileFaqItem.findMany({
        where: { eventUuid },
        select: MOBILE_FAQ_SELECT,
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      }),
    ]);
    return { contacts, faq };
  }
}
