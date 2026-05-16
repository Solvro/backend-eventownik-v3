import { Queue } from "bullmq";
import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import { parseSortInput } from "src/common/utils/prisma.utility";
import { EmailStatus } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import { InjectQueue } from "@nestjs/bullmq";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { CreateEmailDto } from "./dto/create-email.dto";
import { EmailCompleteElementDto } from "./dto/email-complete-element.dto";
import { EmailListElementDto } from "./dto/email-list-element.dto";
import { EmailListingDto } from "./dto/email-listing.dto";
import { EmailResponseDto } from "./dto/email-response.dto";
import { UpdateEmailDto } from "./dto/update-email.dto";

@Injectable()
export class EmailsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue("automatic-emails") private readonly emailQueue: Queue,
  ) {}

  async create(
    eventUuid: string,
    query: CreateEmailDto,
  ): Promise<EmailResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { uuid: eventUuid },
        select: { uuid: true },
      });
      if (event == null) {
        throw new BadRequestException(`Event with id: ${eventUuid} not found`);
      }

      if (query.formId !== undefined) {
        const form = await tx.form.findUnique({
          where: { uuid: query.formId },
        });
        if (form == null) {
          throw new BadRequestException(
            `Form with id: ${query.formId} not found`,
          );
        }
      }

      const emailTemplate = await tx.emailTemplate.create({
        data: {
          name: query.name,
          content: query.content,
          trigger: query.trigger,
          triggerValue: query.triggerValue,
          triggerValue2: query.triggerValue2,
          order: query.order,
          eventUuid,
          formUuid: query.formId,
        },
      });

      return {
        id: emailTemplate.uuid,
        name: emailTemplate.name,
        content: emailTemplate.content,
        trigger: emailTemplate.trigger,
        eventId: emailTemplate.eventUuid,
        createdAt: emailTemplate.createdAt.toISOString(),
        updatedAt: emailTemplate.updatedAt.toISOString(),
      };
    });
  }

  async findAll(
    eventUuid: string,
    query: EmailListingDto,
  ): Promise<PageDto<EmailListElementDto>> {
    const event = await this.prisma.event.findUnique({
      where: { uuid: eventUuid },
    });
    if (event == null) {
      throw new BadRequestException(`Event with id: ${eventUuid} not found`);
    }

    const { skip, take, sort, trigger } = query;
    const orderBy = parseSortInput(sort, ["createdAt", "updatedAt", "name"]);
    const where = {
      eventUuid,
      trigger,
    };

    if (orderBy.length === 0) {
      orderBy.push({ createdAt: "desc" });
    }

    const [itemCount, templates] = await this.prisma.$transaction([
      this.prisma.emailTemplate.count({ where }),
      this.prisma.emailTemplate.findMany({
        where,
        take,
        skip,
        orderBy,
        select: {
          uuid: true,
          eventUuid: true,
          name: true,
          trigger: true,
          triggerValue: true,
          triggerValue2: true,
          createdAt: true,
          updatedAt: true,
          participantEmails: {
            select: { status: true },
          },
        },
      }),
    ]);

    const data: EmailListElementDto[] = templates.map((record) => {
      const counts = record.participantEmails.reduce(
        (accumulator, email) => {
          switch (email.status) {
            case EmailStatus.failed: {
              accumulator.failedCount++;
              break;
            }
            case EmailStatus.pending: {
              accumulator.pendingCount++;
              break;
            }
            case EmailStatus.sent: {
              accumulator.sentCount++;
              break;
            }
          }
          return accumulator;
        },
        { failedCount: 0, pendingCount: 0, sentCount: 0 },
      );

      return {
        id: record.uuid,
        eventId: record.eventUuid,
        name: record.name,
        trigger: record.trigger,
        triggerValue: record.triggerValue,
        triggerValue2: record.triggerValue2,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        meta: counts,
      };
    });

    const meta = new PageMetaDto({ itemCount, pageOptionsDto: query });
    return new PageDto(data, meta);
  }

  async findOne(
    eventUuid: string,
    emailUuid: string,
  ): Promise<EmailCompleteElementDto> {
    const emailTemplate = await this.prisma.emailTemplate.findFirst({
      where: {
        uuid: emailUuid,
        eventUuid,
      },
      include: {
        participantEmails: {
          include: {
            participant: true,
          },
        },
      },
    });

    if (emailTemplate === null) {
      throw new NotFoundException("Email not found");
    }

    const formattedResponse: EmailCompleteElementDto = {
      id: emailTemplate.uuid,
      eventId: emailTemplate.eventUuid,
      name: emailTemplate.name,
      content: emailTemplate.content,
      trigger: emailTemplate.trigger,
      triggerValue: emailTemplate.triggerValue,
      triggerValue2: emailTemplate.triggerValue2,
      formId: emailTemplate.formUuid,
      order: emailTemplate.order,
      createdAt: emailTemplate.createdAt.toISOString(),
      updatedAt: emailTemplate.updatedAt.toISOString(),
      participants: emailTemplate.participantEmails
        .filter((pivot) => pivot.participant !== null)
        .map((pivot) => ({
          id: pivot.participant?.uuid,
          email: pivot.participant?.email,
          createdAt: pivot.participant?.createdAt.toISOString(),
          updatedAt: pivot.participant?.updatedAt.toISOString(),
          meta: {
            pivot_status: pivot.status,
            pivot_send_at: pivot.sendAt.toISOString(),
            pivot_send_by: pivot.sendBy,
          },
        })),
    };

    return formattedResponse;
  }

  async update(
    eventUuid: string,
    emailUuid: string,
    query: UpdateEmailDto,
  ): Promise<EmailResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const existingEmail = await tx.emailTemplate.findFirst({
        where: {
          uuid: emailUuid,
          eventUuid,
        },
        select: { uuid: true },
      });
      if (existingEmail == null) {
        throw new NotFoundException("Email template or event does not exist");
      }

      const emailTemplate = await tx.emailTemplate.update({
        where: {
          uuid: emailUuid,
        },
        data: {
          name: query.name,
          content: query.content,
          trigger: query.trigger,
          triggerValue: query.triggerValue,
          triggerValue2: query.triggerValue2,
          order: query.order,
          formUuid: query.formId,
        },
      });

      return {
        id: emailTemplate.uuid,
        name: emailTemplate.name,
        content: emailTemplate.content,
        trigger: emailTemplate.trigger,
        eventId: emailTemplate.eventUuid,
        createdAt: emailTemplate.createdAt.toISOString(),
        updatedAt: emailTemplate.updatedAt.toISOString(),
      };
    });
  }

  async remove(eventUuid: string, emailUuid: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existingEmail = await tx.emailTemplate.findFirst({
        where: {
          uuid: emailUuid,
          eventUuid,
        },
        select: { uuid: true },
      });
      if (existingEmail == null) {
        throw new NotFoundException("Email template or event does not exist");
      }

      await tx.emailTemplate.delete({
        where: {
          uuid: emailUuid,
        },
      });
    });
  }
}
