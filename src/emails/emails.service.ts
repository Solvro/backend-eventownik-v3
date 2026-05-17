import { MailerService } from "@nestjs-modules/mailer";
import { Queue } from "bullmq";
import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import { parseSortInput } from "src/common/utils/prisma.utility";
import type { Prisma } from "src/generated/prisma/client";
import {
  AttributeType,
  EmailStatus,
  EmailTrigger,
} from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import { InjectQueue } from "@nestjs/bullmq";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { CreateEmailDto } from "./dto/create-email.dto";
import { EmailCompleteElementDto } from "./dto/email-complete-element.dto";
import { EmailListElementDto } from "./dto/email-list-element.dto";
import { EmailListingDto } from "./dto/email-listing.dto";
import { EmailResponseDto } from "./dto/email-response.dto";
import { UpdateEmailDto } from "./dto/update-email.dto";

export interface EmailSendJobData {
  emailUuid: string;
  participantUuid: string;
}

interface EmailTemplateForParsing {
  content: string;
  event: {
    name: string;
    startDate: Date;
    endDate: Date;
    slug: string;
    primaryColor: string | null;
    location: string | null;
    contactEmail: string | null;
    attributes: {
      uuid: string;
      type: AttributeType;
      config: Prisma.JsonValue | null;
    }[];
    forms: {
      uuid: string;
    }[];
  };
}

interface ParticipantForParsing {
  uuid: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  attributes: {
    attributeUuid: string;
    value: Prisma.JsonValue | null;
  }[];
}

@Injectable()
export class EmailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailerService: MailerService,
    @InjectQueue("automatic-emails") private readonly emailQueue: Queue,
    private readonly config: ConfigService,
  ) {}

  private isJsonObject(
    value: Prisma.JsonValue | null,
  ): value is Prisma.JsonObject {
    return value != null && typeof value === "object" && !Array.isArray(value);
  }

  private getJsonObject(
    value: Prisma.JsonValue | null,
  ): Prisma.JsonObject | null {
    if (!this.isJsonObject(value)) {
      return null;
    }

    return value;
  }

  private getStringArray(
    value: Prisma.JsonValue | null,
    key: string,
  ): string[] {
    const config = this.getJsonObject(value);
    if (config == null) {
      return [];
    }

    const rawValues = config[key];
    if (!Array.isArray(rawValues)) {
      return [];
    }

    return rawValues.filter(
      (rawValue): rawValue is string =>
        typeof rawValue === "string" && rawValue.trim().length > 0,
    );
  }

  private stringifyJsonValue(value: Prisma.JsonValue | null): string {
    if (value == null) {
      return "";
    }

    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    return JSON.stringify(value);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

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
          schema: query.schema,
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
        schema: emailTemplate.schema,
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
          schema: true,
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
        schema: record.schema,
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
      // Do not eagerly load participantEmails to avoid large memory usage
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
      schema: emailTemplate.schema,
      order: emailTemplate.order,
      createdAt: emailTemplate.createdAt.toISOString(),
      updatedAt: emailTemplate.updatedAt.toISOString(),
      // participants should be loaded via the dedicated paginated endpoint
      participants: [],
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
          schema: query.schema,
          order: query.order,
        },
      });

      return {
        id: emailTemplate.uuid,
        name: emailTemplate.name,
        content: emailTemplate.content,
        trigger: emailTemplate.trigger,
        eventId: emailTemplate.eventUuid,
        schema: emailTemplate.schema,
        createdAt: emailTemplate.createdAt.toISOString(),
        updatedAt: emailTemplate.updatedAt.toISOString(),
      };
    });
  }

  private async validateTriggerConfig(
    tx: Prisma.TransactionClient,
    eventUuid: string,
    trigger: EmailTrigger,
    config?: Prisma.JsonObject,
  ) {
    if (trigger === EmailTrigger.FORM_FILLED) {
      if (config == null || typeof config.formUuid !== "string") {
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
      if (form == null) {
        throw new BadRequestException(
          "Form not found or does not belong to this event",
        );
      }
    } else if (trigger === EmailTrigger.ATTRIBUTE_CHANGED) {
      if (
        config == null ||
        typeof config.attributeUuid !== "string" ||
        config.expectedValue === undefined
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
      if (attribute == null) {
        throw new BadRequestException(
          "Attribute not found or does not belong to this event",
        );
      }
    } else {
      if (config != null && Object.keys(config).length > 0) {
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

  parseEmailContent(
    emailTemplate: EmailTemplateForParsing,
    participant: ParticipantForParsing,
  ): string {
    let content = emailTemplate.content;
    const tagRegex = /<span[^>]*data-id="([^"]+)"[^>]*>.*?<\/span>/g;

    // static tags replacement
    content = content.replaceAll(tagRegex, (_match: string, dataId: string) => {
      switch (dataId) {
        case "/event_name": {
          return emailTemplate.event.name;
        }
        case "/event_start_date": {
          return emailTemplate.event.startDate.toISOString();
        }
        case "/event_end_date": {
          return emailTemplate.event.endDate.toISOString();
        }
        case "/event_slug": {
          return emailTemplate.event.slug;
        }
        case "/event_primary_color": {
          return emailTemplate.event.primaryColor ?? "";
        }
        case "/event_location": {
          return emailTemplate.event.location ?? "";
        }
        case "/participant_id": {
          return participant.uuid;
        }
        case "/participant_email": {
          return participant.email;
        }
        case "participant_created_at": {
          return participant.createdAt.toISOString();
        }
        case "participant_updated_at": {
          return participant.updatedAt.toISOString();
        }
        default: {
          return _match;
        }
      }
    });

    // dynamic tags replacement
    // very simillar as before, but now we can have /participant_{attributeUUID} which will be replaced with the value of that attribute for the given participant
    for (const participantAttribute of participant.attributes) {
      const attribute = emailTemplate.event.attributes.find(
        (attribute_) => attribute_.uuid === participantAttribute.attributeUuid,
      );

      if (attribute != null) {
        const dynamicTag = `<span data-id="/participant_${attribute.uuid}"></span>`;
        console.log("Processing dynamic tag:", dynamicTag);
        const rawValue = participantAttribute.value;

        if (attribute.type === AttributeType.multiSelect) {
          const selectedValues = Array.isArray(rawValue)
            ? rawValue.filter(
                (value): value is string => typeof value === "string",
              )
            : [];
          const optionNames = this.getStringArray(attribute.config, "options");

          if (optionNames.length > 0 && selectedValues.length > 0) {
            const selectedOptions = optionNames.filter((option) =>
              selectedValues.includes(option),
            );
            content = content.replaceAll(
              new RegExp(dynamicTag, "g"),
              selectedOptions.join(", "),
            );
          } else {
            content = content.replaceAll(
              new RegExp(dynamicTag, "g"),
              this.stringifyJsonValue(rawValue),
            );
          }
        } else if (attribute.type === AttributeType.block) {
          // TODO: implement block name replacement by uuids
        } else {
          content = content.replaceAll(
            new RegExp(dynamicTag, "g"),
            this.stringifyJsonValue(rawValue),
          );
        }
      }
    }

    // TODO: a tag replacement etc.
    // form links replacement eg /form_{formUuid} will be replaced with {APP_DOMAIN}/{eventSlug}/{formUuid}/{participantUuid}
    const formLinkRegex = /<span[^>]*data-id="\/form_([^"]+)"[^>]*><\/span>/g;
    content = content.replaceAll(
      formLinkRegex,
      (match: string, formUuid: string) => {
        const form = emailTemplate.event.forms.find((f) => f.uuid === formUuid);
        if (form != null) {
          const appDomain = process.env.APP_DOMAIN ?? "http://localhost:3000";
          return `${appDomain}/${emailTemplate.event.slug}/${form.uuid}/${participant.uuid}`;
        }
        return match; // if form not found, return the original tag
      },
    );

    return content;
  }
  async sendEmailToParticipants(
    emailUuid: string,
    participantUuids: string[],
  ): Promise<void> {
    if (!participantUuids || participantUuids.length === 0) return;

    const jobs = participantUuids.map((participantUuid) => ({
      name: "send-email-to-participant",
      data: { emailUuid, participantUuid } satisfies EmailSendJobData,
      opts: {
        attempts: 3,
        backoff: {
          delay: 1000,
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

    if (emailTemplate == null) {
      throw new NotFoundException(
        `Email template with id: ${emailUuid} not found`,
      );
    }

    const participant = await this.prisma.participant.findUnique({
      where: { uuid: participantUuid },
      include: { attributes: true },
    });

    if (!participant) {
      // participant not found, record failed status
      await this.prisma.participantEmailStatus.create({
        data: {
          status: EmailStatus.failed,
          sendAt: new Date(),
          participantUuid,
          emailUuid,
        },
      });
      return;
    }

    try {
      const parsedContent = this.parseEmailContent(emailTemplate, participant);

      await this.mailerService.sendMail({
        to: participant.email,
        subject: emailTemplate.name,
        html: parsedContent,
        from: this.config.get<string>("SMTP_FROM") ?? undefined,
        replyTo:
          emailTemplate.event.contactEmail ??
          this.config.get<string>("SMTP_FROM") ??
          undefined,
      });

      await this.prisma.participantEmailStatus.create({
        data: {
          status: EmailStatus.sent,
          sendAt: new Date(),
          participantUuid: participant.uuid,
          emailUuid,
        },
      });
    } catch (error) {
      console.error(`Failed to send email to ${participant.email}:`, error);
      await this.prisma.participantEmailStatus.create({
        data: {
          status: EmailStatus.failed,
          sendAt: new Date(),
          participantUuid: participant.uuid,
          emailUuid,
        },
      });
    }
  }

  async findParticipantsForEmail(
    eventUuid: string,
    emailUuid: string,
    pageOptions: import("src/common/dto/page-options.dto").PageOptionsDto,
  ) {
    // validate ownership
    const email = await this.prisma.emailTemplate.findFirst({
      where: { uuid: emailUuid, eventUuid },
      select: { uuid: true },
    });
    if (!email) {
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
      createdAt: p.participant?.createdAt?.toISOString(),
      updatedAt: p.participant?.updatedAt?.toISOString(),
      meta: {
        pivot_status: p.status,
        pivot_send_at: p.sendAt.toISOString(),
        pivot_send_by: p.sendBy,
      },
    }));

    const meta = new PageMetaDto({ itemCount, pageOptionsDto: pageOptions });
    return new PageDto(data, meta);
  }
}
