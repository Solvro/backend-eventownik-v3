import { PrismaService } from "src/prisma/prisma.service";
import { StorageService } from "src/storage/storage.service";

import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { TicketPublic } from "./entities/ticket-public.entity";

@Injectable()
export class TicketPublicService {
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    configService: ConfigService,
  ) {
    this.bucket = configService.getOrThrow<string>("S3_BUCKET_EVENTS");
  }

  async findByToken(eventSlug: string, token: string): Promise<TicketPublic> {
    const participant = await this.prisma.participant.findUnique({
      where: { ticketToken: token },
      select: {
        ticketToken: true,
        event: {
          select: {
            slug: true,
            name: true,
            startDate: true,
            endDate: true,
            location: true,
            primaryColor: true,
            photoKey: true,
            _count: { select: { tickets: true } },
          },
        },
      },
    });

    const event = participant?.event;
    if (
      participant === null ||
      event?.slug !== eventSlug ||
      event._count.tickets === 0
    ) {
      throw new NotFoundException("Ticket not found");
    }

    return {
      token: participant.ticketToken,
      event: {
        name: event.name,
        startDate: event.startDate,
        endDate: event.endDate,
        location: event.location,
        primaryColor: event.primaryColor,
        photoUrl:
          event.photoKey === null
            ? null
            : this.storageService.getUrl(this.bucket, event.photoKey),
      },
    };
  }
}
