import { MailerService } from "@nestjs-modules/mailer";
import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import { parseSortInput } from "src/common/utils/prisma.utility";
import {
  AttributeType,
  EmailStatus,
  EmailTrigger,
} from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

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
    private readonly mailerService: MailerService,
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

      await this.validateTriggerConfig(
        tx,
        eventUuid,
        query.trigger,
        query.triggerConfig,
      );

      const emailTemplate = await tx.emailTemplate.create({
        data: {
          name: query.name,
          content: query.content,
          trigger: query.trigger,
          triggerConfig: query.triggerConfig ?? {},
          order: query.order,
          eventUuid,
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
          triggerConfig: true,
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
        triggerConfig: record.triggerConfig,
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
      triggerConfig: emailTemplate.triggerConfig,
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

      if (query.trigger) {
        await this.validateTriggerConfig(
          tx,
          eventUuid,
          query.trigger,
          query.triggerConfig,
        );
      }

      const emailTemplate = await tx.emailTemplate.update({
        where: {
          uuid: emailUuid,
        },
        data: {
          name: query.name,
          content: query.content,
          trigger: query.trigger,
          triggerConfig: query.triggerConfig ?? {},
          order: query.order,
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

  private async validateTriggerConfig(
    tx: any,
    eventUuid: string,
    trigger: EmailTrigger,
    config?: any,
  ) {
    if (trigger === EmailTrigger.FORM_FILLED) {
      if (!config || typeof config.formUuid !== "string") {
        throw new BadRequestException(
          "triggerConfig must contain formUuid for FORM_FILLED trigger",
        );
      }
      if (Object.keys(config).length > 1) {
        throw new BadRequestException(
          "triggerConfig contains extra properties",
        );
      }
      const form = await tx.form.findFirst({
        where: { uuid: config.formUuid, eventUuid },
      });
      if (!form) {
        throw new BadRequestException(
          "Form not found or does not belong to this event",
        );
      }
    } else if (trigger === EmailTrigger.ATTRIBUTE_CHANGED) {
      if (
        !config ||
        typeof config.attributeUuid !== "string" ||
        typeof config.expectedValue === "undefined"
      ) {
        throw new BadRequestException(
          "triggerConfig must contain attributeUuid and expectedValue for ATTRIBUTE_CHANGED trigger",
        );
      }
      if (Object.keys(config).length > 2) {
        throw new BadRequestException(
          "triggerConfig contains extra properties",
        );
      }
      const attribute = await tx.attribute.findFirst({
        where: { uuid: config.attributeUuid, eventUuid },
      });
      if (!attribute) {
        throw new BadRequestException(
          "Attribute not found or does not belong to this event",
        );
      }
    } else {
      if (config && Object.keys(config).length > 0) {
        throw new BadRequestException(
          "triggerConfig is not expected for this trigger type",
        );
      }
    }
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

  parseEmailContent(emailTemplate: any, participant: any): string {
    let content = emailTemplate.content;
    const tagRegex = /<span[^>]*data-id="([^"]+)"[^>]*>.*?<\/span>/g;

    // static tags replacement
    content = content.replace(tagRegex, (match, dataId) => {
      switch (dataId) {
        case "/event_name":
          return emailTemplate.event.name;
        case "/event_start_date":
          return emailTemplate.event.startDate.toISOString();
        case "/event_end_date":
          return emailTemplate.event.endDate.toISOString();
        case "/event_slug":
          return emailTemplate.event.slug;
        case "/event_primary_color":
          return emailTemplate.event.primaryColor || "";
        case "/event_location":
          return emailTemplate.event.location || "";
        case "/participant_id":
          return participant.uuid;
        case "/participant_email":
          return participant.email;
        case "participant_created_at":
          return participant.createdAt.toISOString();
        case "participant_updated_at":
          return participant.updatedAt.toISOString();
        default:
          return dataId;
      }
    });

    // dynamic tags replacement
    // very simillar as before, but now we can have /participant_{attributeUUID} which will be replaced with the value of that attribute for the given participant
    for (const participantAttribute of participant.attributes) {
      const attribute = emailTemplate.event.attributes.find(
        (attr) => attr.uuid === participantAttribute.attributeUuid,
      );

      if (attribute) {
        const dynamicTag = `<span data-id="/participant_${attribute.uuid}"></span>`;
        const rawValue = participantAttribute.value;

        if (attribute.type === AttributeType.multiSelect) {
          try {
            const value = rawValue as string[];
            const optionNames = (
              (attribute.config as { options: string[] }).options as string[]
            ).filter((option) => value.includes(option));
            content = content.replace(
              new RegExp(dynamicTag, "g"),
              optionNames.join(", "),
            );
          } catch (error) {
            // If parsing fails, replace with raw value
            content = content.replace(
              new RegExp(dynamicTag, "g"),
              rawValue as string,
            );
          }
        } else if (attribute.type == AttributeType.block) {
          // TODO: implement block name replacement by uuids
        } else {
          content = content.replace(
            new RegExp(dynamicTag, "g"),
            rawValue as string,
          );
        }
      }
    }

    // TODO: a tag replacement etc.
    // form links replacement eg /form_{formUuid} will be replaced with {APP_DOMAIN}/{eventSlug}/{formUuid}/{participantUuid}
    const formLinkRegex = /<span[^>]*data-id="\/form_([^"]+)"[^>]*><\/span>/g;
    content = content.replace(formLinkRegex, (match, formUuid) => {
      const form = emailTemplate.event.forms.find((f) => f.uuid === formUuid);
      if (form) {
        const appDomain = process.env.APP_DOMAIN || "http://localhost:3000";
        return `${appDomain}/${emailTemplate.event.slug}/${form.uuid}/${participant.uuid}`;
      }
      return match; // if form not found, return the original tag
    });

    return content;
  }
  async sendEmailToParticipants(
    emailUuid: string,
    participantUuids: string[],
  ): Promise<void> {
    const emailTemplate = await this.prisma.emailTemplate.findUnique({
      where: { uuid: emailUuid },
      include: {
        event: {
          include: {
            attributes: true,
            forms: true,
          },
        },
      },
    });

    if (!emailTemplate) {
      throw new NotFoundException(
        `Email template with id: ${emailUuid} not found`,
      );
    }

    const participants = await this.prisma.participant.findMany({
      where: { uuid: { in: participantUuids } },
      include: { attributes: true },
    });

    for (const participant of participants) {
      try {
        const parsedContent = this.parseEmailContent(
          emailTemplate,
          participant,
        );

        await this.mailerService.sendMail({
          to: participant.email,
          subject: emailTemplate.name,
          html: parsedContent,
          from: emailTemplate.event.contactEmail || process.env.SMTP_FROM,
        });

        await this.prisma.participantEmailStatus.create({
          data: {
            status: EmailStatus.sent,
            sendAt: new Date(),
            participantUuid: participant.uuid,
            emailUuid: emailUuid,
          },
        });
      } catch (error) {
        console.error(`Failed to send email to ${participant.email}:`, error);
        await this.prisma.participantEmailStatus.create({
          data: {
            status: EmailStatus.failed,
            sendAt: new Date(),
            participantUuid: participant.uuid,
            emailUuid: emailUuid,
          },
        });
      }
    }
  }
}
