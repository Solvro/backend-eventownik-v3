import { randomUUID } from "node:crypto";
import {
  AuditAction,
  AuditEntityType,
} from "src/audit-log/audit-log.constants";
import { AuditLogService } from "src/audit-log/audit-log.service";
import type { AuditActor } from "src/audit-log/audit-log.types";
import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import { parseSortInput } from "src/common/utils/prisma.utility";
import { EmailTemplate, Prisma } from "src/generated/prisma/client";
import { EmailStatus, EmailTrigger } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { CreateEmailDto } from "./dto/create-email.dto";
import { DuplicateEmailDto } from "./dto/duplicate-email.dto";
import { EmailCompleteElementDto } from "./dto/email-complete-element.dto";
import { EmailListElementDto } from "./dto/email-list-element.dto";
import { EmailListingDto } from "./dto/email-listing.dto";
import { EmailResponseDto } from "./dto/email-response.dto";
import { UpdateEmailDto } from "./dto/update-email.dto";

interface StatusCounts {
  failedCount: number;
  pendingCount: number;
  sentCount: number;
}

const AUDITED_EMAIL_FIELDS = ["name", "trigger", "triggerConfig", "order"];
const OPAQUE_EMAIL_FIELDS = ["content", "schema"];

@Injectable()
export class EmailTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async recordEmailAudit(
    tx: Prisma.TransactionClient,
    eventUuid: string,
    actor: AuditActor,
    change: {
      action:
        | typeof AuditAction.EmailTemplateCreated
        | typeof AuditAction.EmailTemplateUpdated
        | typeof AuditAction.EmailTemplateDeleted;
      before: EmailTemplate | null;
      after: EmailTemplate | null;
      correlationId?: string;
    },
  ) {
    const changes = this.auditLog.fieldChanges(
      change.before,
      change.after,
      AUDITED_EMAIL_FIELDS,
      OPAQUE_EMAIL_FIELDS,
    );
    if (changes.length === 0) {
      return;
    }

    const template = change.after ?? change.before;
    await this.auditLog.record(tx, {
      eventUuid,
      action: change.action,
      actor,
      entityType: AuditEntityType.EmailTemplate,
      entityUuid: template?.uuid,
      entityLabel: template?.name,
      changes,
      correlationId: change.correlationId,
    });
  }

  async create(
    eventUuid: string,
    query: CreateEmailDto,
    actor: AuditActor,
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
          schema: query.schema === null ? Prisma.DbNull : query.schema,
          order: query.order,
          eventUuid,
        },
      });

      await this.recordEmailAudit(tx, eventUuid, actor, {
        action: AuditAction.EmailTemplateCreated,
        before: null,
        after: emailTemplate,
      });

      return {
        id: emailTemplate.uuid,
        name: emailTemplate.name,
        content: emailTemplate.content,
        trigger: emailTemplate.trigger,
        triggerConfig: emailTemplate.triggerConfig,
        order: emailTemplate.order,
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
    const orderBy = parseSortInput(sort, [
      "createdAt",
      "updatedAt",
      "name",
      "order",
    ]);
    const where = {
      eventUuid,
      trigger,
    };

    if (orderBy.length === 0) {
      orderBy.push({ createdAt: "desc" });
    } else if (orderBy.some((criterion) => "order" in criterion)) {
      orderBy.push({ createdAt: "asc" });
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
          order: true,
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
      order: record.order,
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
    };

    return formattedResponse;
  }

  async update(
    eventUuid: string,
    emailUuid: string,
    query: UpdateEmailDto,
    actor: AuditActor,
  ): Promise<EmailResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const existingEmail = await tx.emailTemplate.findFirst({
        where: {
          uuid: emailUuid,
          eventUuid,
        },
      });
      if (existingEmail == null) {
        throw new NotFoundException("Email template or event does not exist");
      }

      const triggerChanged =
        query.trigger !== undefined && query.trigger !== existingEmail.trigger;

      if (triggerChanged || query.triggerConfig !== undefined) {
        await this.validateTriggerConfig(
          tx,
          eventUuid,
          query.trigger ?? existingEmail.trigger,
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
          triggerConfig:
            query.triggerConfig ?? (triggerChanged ? {} : undefined),
          schema: query.schema === null ? Prisma.DbNull : query.schema,
          order: query.order,
        },
      });

      await this.recordEmailAudit(tx, eventUuid, actor, {
        action: AuditAction.EmailTemplateUpdated,
        before: existingEmail,
        after: emailTemplate,
      });

      return {
        id: emailTemplate.uuid,
        name: emailTemplate.name,
        content: emailTemplate.content,
        trigger: emailTemplate.trigger,
        triggerConfig: emailTemplate.triggerConfig,
        order: emailTemplate.order,
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

  async reorder(
    eventUuid: string,
    emailUuids: string[],
    actor: AuditActor,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const matching = await tx.emailTemplate.count({
        where: { eventUuid, uuid: { in: emailUuids } },
      });
      if (matching !== emailUuids.length) {
        throw new NotFoundException(
          "One or more email templates do not belong to this event",
        );
      }

      const existing = await tx.emailTemplate.findMany({
        where: { eventUuid, uuid: { in: emailUuids } },
      });
      const previous = new Map(
        existing.map((template) => [template.uuid, template]),
      );
      const correlationId = randomUUID();

      for (const [index, uuid] of emailUuids.entries()) {
        const updated = await tx.emailTemplate.update({
          where: { uuid },
          data: { order: index },
        });
        await this.recordEmailAudit(tx, eventUuid, actor, {
          action: AuditAction.EmailTemplateUpdated,
          before: previous.get(uuid) ?? null,
          after: updated,
          correlationId,
        });
      }
    });
  }

  async remove(
    eventUuid: string,
    emailUuid: string,
    actor: AuditActor,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existingEmail = await tx.emailTemplate.findFirst({
        where: {
          uuid: emailUuid,
          eventUuid,
        },
      });
      if (existingEmail == null) {
        throw new NotFoundException("Email template or event does not exist");
      }

      await tx.emailTemplate.delete({
        where: {
          uuid: emailUuid,
        },
      });

      await this.recordEmailAudit(tx, eventUuid, actor, {
        action: AuditAction.EmailTemplateDeleted,
        before: existingEmail,
        after: null,
      });
    });
  }

  async duplicate(
    eventUuid: string,
    emailUuid: string,
    query: DuplicateEmailDto,
    actor: AuditActor,
  ): Promise<EmailResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const sourceEmail = await tx.emailTemplate.findFirst({
        where: { uuid: emailUuid, eventUuid },
      });
      if (sourceEmail == null) {
        throw new NotFoundException("Email template or event does not exist");
      }

      const emailTemplate = await tx.emailTemplate.create({
        data: {
          name: query.name ?? `${sourceEmail.name} - copy`,
          content: sourceEmail.content,
          trigger: sourceEmail.trigger,
          triggerConfig:
            sourceEmail.triggerConfig == null
              ? {}
              : (sourceEmail.triggerConfig as Prisma.InputJsonValue),
          schema:
            sourceEmail.schema == null
              ? Prisma.JsonNull
              : (sourceEmail.schema as Prisma.InputJsonValue),
          order: sourceEmail.order,
          eventUuid,
        },
      });

      await this.recordEmailAudit(tx, eventUuid, actor, {
        action: AuditAction.EmailTemplateCreated,
        before: null,
        after: emailTemplate,
      });

      return {
        id: emailTemplate.uuid,
        name: emailTemplate.name,
        content: emailTemplate.content,
        trigger: emailTemplate.trigger,
        triggerConfig: emailTemplate.triggerConfig,
        order: emailTemplate.order,
        eventId: emailTemplate.eventUuid,
        schema: emailTemplate.schema,
        createdAt: emailTemplate.createdAt.toISOString(),
        updatedAt: emailTemplate.updatedAt.toISOString(),
      };
    });
  }
}
