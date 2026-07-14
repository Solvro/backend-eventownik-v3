import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import { parseSortInput } from "src/common/utils/prisma.utility";
import type { Prisma } from "src/generated/prisma/client";
import { EmailStatus, EmailTrigger } from "src/generated/prisma/enums";
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

type StatusCounts = {
  failedCount: number;
  pendingCount: number;
  sentCount: number;
};

@Injectable()
export class EmailTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

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
        },
      }),
    ]);

    const countsByTemplate = await this.getStatusCounts(
      templates.map((template) => template.uuid),
    );

    const data: EmailListElementDto[] = templates.map((record) => ({
      id: record.uuid,
      eventId: record.eventUuid,
      name: record.name,
      trigger: record.trigger,
      triggerConfig: record.triggerConfig,
      schema: record.schema,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      meta: countsByTemplate.get(record.uuid) ?? {
        failedCount: 0,
        pendingCount: 0,
        sentCount: 0,
      },
    }));

    const meta = new PageMetaDto({ itemCount, pageOptionsDto: query });
    return new PageDto(data, meta);
  }

  private async getStatusCounts(
    templateUuids: string[],
  ): Promise<Map<string, StatusCounts>> {
    const countsByTemplate = new Map<string, StatusCounts>();
    if (templateUuids.length === 0) {
      return countsByTemplate;
    }

    const statusCounts = await this.prisma.participantEmailStatus.groupBy({
      by: ["emailUuid", "status"],
      where: { emailUuid: { in: templateUuids } },
      _count: { _all: true },
    });

    for (const row of statusCounts) {
      if (row.emailUuid == null) {
        continue;
      }

      const counts = countsByTemplate.get(row.emailUuid) ?? {
        failedCount: 0,
        pendingCount: 0,
        sentCount: 0,
      };

      switch (row.status) {
        case EmailStatus.failed: {
          counts.failedCount = row._count._all;
          break;
        }
        case EmailStatus.pending: {
          counts.pendingCount = row._count._all;
          break;
        }
        case EmailStatus.sent: {
          counts.sentCount = row._count._all;
          break;
        }
      }

      countsByTemplate.set(row.emailUuid, counts);
    }

    return countsByTemplate;
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
}
