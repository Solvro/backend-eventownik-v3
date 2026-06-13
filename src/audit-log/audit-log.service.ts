import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, LogTrigger } from "../generated/prisma/client";

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    action: string;
    entityType: string;
    entityUuid?: string;
    triggeredBy?: string;
    before?: Prisma.InputJsonValue | null;
    after?: Prisma.InputJsonValue | null;
  }) {
    return this.prisma.auditLog.create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityUuid: params.entityUuid,
        triggeredBy: params.triggeredBy,
        before: params.before ?? undefined,
        after: params.after ?? undefined,
      },
    });
  }

  async logFormInteraction(
    tx: Prisma.TransactionClient,
    participantUuid: string,
    formUuid: string,
    interactionType: "OPENED" | "SUBMITTED",
  ) {
    const now = new Date();

    return tx.participantFormLog.upsert({
      where: { participantUuid_formUuid: { participantUuid, formUuid } },
      create: {
        participantUuid,
        formUuid,
        ...(interactionType === "OPENED"
          ? { lastOpenedAt: now }
          : { lastSubmittedAt: now }),
      },
      update: {
        ...(interactionType === "OPENED"
          ? { lastOpenedAt: now }
          : { lastSubmittedAt: now }),
      },
    });
  }

  async logAttributeChanges(
    tx: Prisma.TransactionClient,
    participantUuid: string,
    oldAttributes: {
      attributeUuid: string;
      value: Prisma.InputJsonValue | null;
    }[],
    newAttributes: {
      attributeUuid: string;
      value: Prisma.InputJsonValue | null;
    }[],
    triggerInfo: { by: LogTrigger; uuid?: string },
  ) {
    const oldMap = new Map(
      oldAttributes.map((a) => [a.attributeUuid, a.value]),
    );

    const changedEntries: {
      attributeUuid: string;
      before: Prisma.InputJsonValue | null;
      after: Prisma.InputJsonValue | null;
    }[] = [];

    for (const newAttr of newAttributes) {
      const hadOld = oldMap.has(newAttr.attributeUuid);
      const oldValue = hadOld
        ? (oldMap.get(newAttr.attributeUuid) ?? null)
        : null;

      if (JSON.stringify(oldValue) !== JSON.stringify(newAttr.value)) {
        changedEntries.push({
          attributeUuid: newAttr.attributeUuid,
          before: hadOld ? oldValue : null,
          after: newAttr.value,
        });
      }
    }

    if (changedEntries.length === 0) {
      return [];
    }

    return Promise.all(
      changedEntries.map((entry) =>
        tx.participantAttributeLog.create({
          data: {
            participantUuid,
            attributeUuid: entry.attributeUuid,
            before: entry.before ?? undefined,
            after: entry.after ?? undefined,
            triggeredBy: triggerInfo.by,
            triggeredUuid: triggerInfo.uuid,
          },
        }),
      ),
    );
  }
}
