import { Injectable } from "@nestjs/common";

import { AttributeType, Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildAttributeChange,
  diffFields,
  diffList,
  toStringArray,
} from "./audit-diff";
import type {
  AuditAttributeRef,
  AuditChange,
  AuditEntry,
} from "./audit-log.types";

export interface AttributeValueChangeInput {
  attribute: AuditAttributeRef;
  before: unknown;
  after: unknown;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  fieldChanges(
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    fields: readonly string[],
    opaqueFields: readonly string[] = [],
  ): AuditChange[] {
    return diffFields(before, after, fields, opaqueFields);
  }

  listChange(
    field: string,
    before: readonly Prisma.JsonValue[],
    after: readonly Prisma.JsonValue[],
  ): AuditChange[] {
    const change = diffList(field, before, after);
    return change === null ? [] : [change];
  }

  async record(tx: Prisma.TransactionClient, entry: AuditEntry) {
    await this.recordMany(tx, [entry]);
  }

  async recordMany(tx: Prisma.TransactionClient, entries: AuditEntry[]) {
    if (entries.length === 0) {
      return;
    }

    await tx.auditLog.createMany({
      data: entries.map((entry) => ({
        eventUuid: entry.eventUuid,
        action: entry.action,
        actorType: entry.actor.type,
        actorUuid: entry.actor.uuid,
        actorName: entry.actor.name,
        entityType: entry.entityType,
        entityUuid: entry.entityUuid,
        entityLabel: entry.entityLabel,
        changes: entry.changes as Prisma.InputJsonValue | undefined,
        correlationId: entry.correlationId,
      })),
    });
  }

  async attributeValueChanges(
    tx: Prisma.TransactionClient,
    inputs: AttributeValueChangeInput[],
  ): Promise<AuditChange[]> {
    const blockUuids = new Set<string>();
    const fileKeys = new Set<string>();

    for (const { attribute, before, after } of inputs) {
      if (attribute.type === AttributeType.block) {
        for (const uuid of [
          ...toStringArray(before),
          ...toStringArray(after),
        ]) {
          blockUuids.add(uuid);
        }
      }
      if (
        attribute.type === AttributeType.file ||
        attribute.type === AttributeType.drawing
      ) {
        for (const value of [before, after]) {
          if (typeof value === "string" && value !== "") {
            fileKeys.add(value);
          }
        }
      }
    }

    const [blocks, files] = await Promise.all([
      blockUuids.size === 0
        ? Promise.resolve([] as { uuid: string; name: string }[])
        : tx.block.findMany({
            where: { uuid: { in: [...blockUuids] } },
            select: { uuid: true, name: true },
          }),
      fileKeys.size === 0
        ? Promise.resolve([] as { fileKey: string; originalName: string }[])
        : tx.uploadedFile.findMany({
            where: { fileKey: { in: [...fileKeys] } },
            select: { fileKey: true, originalName: true },
          }),
    ]);

    const lookups = {
      blockNames: new Map(blocks.map((block) => [block.uuid, block.name])),
      fileNames: new Map(
        files.map((file) => [file.fileKey, file.originalName]),
      ),
    };

    return inputs.flatMap(({ attribute, before, after }) => {
      const change = buildAttributeChange(attribute, before, after, lookups);
      return change === null ? [] : [change];
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
}
