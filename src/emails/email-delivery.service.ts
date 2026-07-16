import { MailerService } from "@nestjs-modules/mailer";
import { Queue } from "bullmq";
import { randomUUID } from "node:crypto";
import { PageMetaDto } from "src/common/dto/page-meta.dto";
import type { PageOptionsDto } from "src/common/dto/page-options.dto";
import { PageDto } from "src/common/dto/page.dto";
import { EmailStatus } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import { InjectQueue } from "@nestjs/bullmq";
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ParticipantForParsing } from "./email-content-parser.service";
import { EmailContentParserService } from "./email-content-parser.service";
import { EMAIL_QUEUE_NAME, EMAIL_SEND_JOB_NAME } from "./emails.constants";

export interface EmailSendJobData {
  emailUuid: string;
  participantUuid: string;
  statusUuid: string;
  participantSnapshot?: ParticipantForParsing;
}

@Injectable()
export class EmailDeliveryService {
  private readonly logger = new Logger(EmailDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailerService: MailerService,
    @InjectQueue(EMAIL_QUEUE_NAME) private readonly emailQueue: Queue,
    private readonly config: ConfigService,
    private readonly contentParser: EmailContentParserService,
  ) {}

  private participantStatusUuid(
    participantUuid: string,
    participantSnapshot: ParticipantForParsing | undefined,
  ): string | null {
    return participantSnapshot == null ? participantUuid : null;
  }

  private async markStatus(
    statusUuid: string,
    status: EmailStatus,
  ): Promise<void> {
    await this.prisma.participantEmailStatus.updateMany({
      where: { uuid: statusUuid },
      data: { status, sendAt: new Date() },
    });
  }

  async sendEmailToParticipants(
    emailUuid: string,
    participantUuids: string[],
    participantSnapshot?: ParticipantForParsing,
  ): Promise<void> {
    if (participantUuids.length === 0) {
      return;
    }

    const statusUuids = participantUuids.map(() => randomUUID());

    await this.prisma.participantEmailStatus.createMany({
      data: participantUuids.map((participantUuid, index) => ({
        uuid: statusUuids[index],
        status: EmailStatus.pending,
        sendAt: new Date(),
        participantUuid: this.participantStatusUuid(
          participantUuid,
          participantSnapshot,
        ),
        emailUuid,
      })),
    });

    const jobs = participantUuids.map((participantUuid, index) => ({
      name: EMAIL_SEND_JOB_NAME,
      data: {
        emailUuid,
        participantUuid,
        statusUuid: statusUuids[index],
        participantSnapshot,
      } satisfies EmailSendJobData,
      opts: {
        attempts: 3,
        backoff: {
          delay: 5000,
          type: "exponential",
        },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    }));

    await this.emailQueue.addBulk(jobs);
  }

  async deliverEmailToParticipants(
    emailUuid: string,
    participantUuid: string,
    statusUuid: string,
    participantSnapshot?: ParticipantForParsing,
  ): Promise<void> {
    const emailTemplate = await this.prisma.emailTemplate.findUnique({
      where: { uuid: emailUuid },
      include: {
        event: {
          include: {
            attributes: { include: { blocks: true } },
            forms: true,
          },
        },
      },
    });

    if (emailTemplate == null) {
      await this.markStatus(statusUuid, EmailStatus.failed);
      throw new NotFoundException(
        `Email template with id: ${emailUuid} not found`,
      );
    }

    const participant =
      participantSnapshot ??
      (await this.prisma.participant.findUnique({
        where: { uuid: participantUuid },
        include: { attributes: true },
      }));

    if (participant == null) {
      await this.markStatus(statusUuid, EmailStatus.failed);
      throw new NotFoundException(
        `Participant with id: ${participantUuid} not found`,
      );
    }

    try {
      const parsedContent = this.contentParser.parseEmailContent(
        emailTemplate,
        participant,
      );

      await this.mailerService.sendMail({
        to: participant.email,
        subject: emailTemplate.name,
        html: parsedContent.html,
        attachments: parsedContent.attachments,
        from: this.config.get<string>("SMTP_FROM") ?? undefined,
        replyTo:
          emailTemplate.event.contactEmail ??
          this.config.get<string>("SMTP_FROM") ??
          undefined,
      });

      await this.markStatus(statusUuid, EmailStatus.sent);
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${participant.email}`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.markStatus(statusUuid, EmailStatus.failed);
      throw error;
    }
  }

  async sendManualEmail(
    eventUuid: string,
    emailUuid: string,
    participantUuids: string[],
  ): Promise<void> {
    const emailTemplate = await this.prisma.emailTemplate.findFirst({
      where: { uuid: emailUuid, eventUuid },
      select: { uuid: true },
    });
    if (emailTemplate == null) {
      throw new NotFoundException("Email template not found");
    }

    const matchingParticipantsCount = await this.prisma.participant.count({
      where: { uuid: { in: participantUuids }, eventUuid },
    });
    if (matchingParticipantsCount !== participantUuids.length) {
      throw new BadRequestException(
        "One or more participants were not found in this event",
      );
    }

    await this.sendEmailToParticipants(emailUuid, participantUuids);
  }

  async sendTestEmail(
    eventUuid: string,
    emailUuid: string,
    targetEmail: string,
    participantUuid?: string,
  ): Promise<void> {
    const emailTemplate = await this.prisma.emailTemplate.findFirst({
      where: { uuid: emailUuid, eventUuid },
      include: {
        event: {
          include: {
            attributes: { include: { blocks: true } },
            forms: true,
          },
        },
      },
    });
    if (emailTemplate == null) {
      throw new NotFoundException("Email template not found");
    }

    let participant: ParticipantForParsing;
    if (participantUuid == null) {
      const now = new Date();
      participant = {
        uuid: "00000000-0000-0000-0000-000000000000",
        email: targetEmail,
        createdAt: now,
        updatedAt: now,
        attributes: [],
      };
    } else {
      const found = await this.prisma.participant.findFirst({
        where: { uuid: participantUuid, eventUuid },
        include: { attributes: true },
      });
      if (found == null) {
        throw new BadRequestException("Participant not found in this event");
      }
      participant = found;
    }

    const parsedContent = this.contentParser.parseEmailContent(
      emailTemplate,
      participant,
    );

    await this.mailerService.sendMail({
      to: targetEmail,
      subject: `[TEST] ${emailTemplate.name}`,
      html: parsedContent.html,
      attachments: parsedContent.attachments,
      from: this.config.get<string>("SMTP_FROM") ?? undefined,
      replyTo:
        emailTemplate.event.contactEmail ??
        this.config.get<string>("SMTP_FROM") ??
        undefined,
    });
  }

  async findParticipantsForEmail(
    eventUuid: string,
    emailUuid: string,
    pageOptions: PageOptionsDto,
  ) {
    // validate ownership
    const email = await this.prisma.emailTemplate.findFirst({
      where: { uuid: emailUuid, eventUuid },
      select: { uuid: true },
    });
    if (email == null) {
      throw new NotFoundException("Email not found");
    }

    const where = { emailUuid };
    const [itemCount, items] = await this.prisma.$transaction([
      this.prisma.participantEmailStatus.count({ where }),
      this.prisma.participantEmailStatus.findMany({
        where,
        take: pageOptions.take,
        skip: pageOptions.skip,
        orderBy: { sendAt: "desc" },
        include: {
          participant: {
            select: {
              uuid: true,
              email: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      }),
    ]);

    const data = items.map((p) => ({
      id: p.participant?.uuid,
      email: p.participant?.email,
      createdAt: p.participant?.createdAt.toISOString(),
      updatedAt: p.participant?.updatedAt.toISOString(),
      status: p.status,
      sendAt: p.sendAt.toISOString(),
      sendBy: p.sendBy,
    }));

    const meta = new PageMetaDto({ itemCount, pageOptionsDto: pageOptions });
    return new PageDto(data, meta);
  }
}
