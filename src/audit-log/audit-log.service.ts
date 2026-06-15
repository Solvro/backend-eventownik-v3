import { Injectable } from "@nestjs/common";

import { LogTrigger, Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(parameters: {
    action: string;
    entityType: string;
    entityUuid?: string;
    triggeredBy?: string;
    before?: Prisma.InputJsonValue | null;
    after?: Prisma.InputJsonValue | null;
  }) {
    return this.prisma.auditLog.create({
      data: {
        action: parameters.action,
        entityType: parameters.entityType,
        entityUuid: parameters.entityUuid,
        triggeredBy: parameters.triggeredBy,
        before: parameters.before ?? undefined,
        after: parameters.after ?? undefined,
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

    for (const newAttribute of newAttributes) {
      const hadOld = oldMap.has(newAttribute.attributeUuid);
      const oldValue = hadOld
        ? (oldMap.get(newAttribute.attributeUuid) ?? null)
        : null;

      if (JSON.stringify(oldValue) !== JSON.stringify(newAttribute.value)) {
        changedEntries.push({
          attributeUuid: newAttribute.attributeUuid,
          before: hadOld ? oldValue : null,
          after: newAttribute.value,
        });
      }
    }

    if (changedEntries.length === 0) {
      return [];
    }

    return Promise.all(
      changedEntries.map(async (entry) =>
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
