import { AttributeType } from "src/generated/prisma/client";
import type { Prisma } from "src/generated/prisma/client";

import type {
  AuditAttributeRef,
  AuditBlockRef,
  AuditChange,
} from "./audit-log.types";

type JsonRecord = Record<string, unknown>;

export interface AttributeValueLookups {
  blockNames: ReadonlyMap<string, string>;
  fileNames: ReadonlyMap<string, string>;
}

function toJson(value: unknown): Prisma.JsonValue {
  if (value === undefined || value === null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value as Prisma.JsonValue;
}

function isSame(a: unknown, b: unknown): boolean {
  return JSON.stringify(toJson(a)) === JSON.stringify(toJson(b));
}

function toArray(value: unknown): Prisma.JsonValue[] {
  return Array.isArray(value) ? (value as Prisma.JsonValue[]) : [];
}

function setDifference(
  source: Prisma.JsonValue[],
  other: Prisma.JsonValue[],
): Prisma.JsonValue[] {
  const otherKeys = new Set(other.map((item) => JSON.stringify(item)));
  return source.filter((item) => !otherKeys.has(JSON.stringify(item)));
}

export function toStringArray(value: unknown): string[] {
  return toArray(value).map(String);
}

export function diffFields(
  before: JsonRecord | null,
  after: JsonRecord | null,
  fields: readonly string[],
): AuditChange[] {
  const changes: AuditChange[] = [];

  for (const field of fields) {
    const from = toJson(before?.[field]);
    const to = toJson(after?.[field]);
    if (!isSame(from, to)) {
      changes.push({ kind: "value", field, from, to });
    }
  }

  return changes;
}

export function buildAttributeChange(
  attribute: AuditAttributeRef,
  before: unknown,
  after: unknown,
  lookups: AttributeValueLookups,
): AuditChange | null {
  if (isSame(before, after)) {
    return null;
  }

  const base = { field: attribute.name, attribute };

  if (attribute.type === AttributeType.multiSelect) {
    const beforeItems = toArray(before);
    const afterItems = toArray(after);
    const added = setDifference(afterItems, beforeItems);
    const removed = setDifference(beforeItems, afterItems);
    if (added.length === 0 && removed.length === 0) {
      return null;
    }
    return { kind: "list", ...base, added, removed };
  }

  if (attribute.type === AttributeType.block) {
    const beforeIds = toStringArray(before);
    const afterIds = toStringArray(after);
    const toRef = (uuid: string): AuditBlockRef => ({
      uuid,
      name: lookups.blockNames.get(uuid) ?? uuid,
    });
    const added = afterIds
      .filter((id) => !beforeIds.includes(id))
      .map((id) => toRef(id));
    const removed = beforeIds
      .filter((id) => !afterIds.includes(id))
      .map((id) => toRef(id));
    if (added.length === 0 && removed.length === 0) {
      return null;
    }
    return { kind: "blocks", ...base, added, removed };
  }

  if (
    attribute.type === AttributeType.file ||
    attribute.type === AttributeType.drawing
  ) {
    const toRef = (value: unknown) =>
      typeof value === "string" && value !== ""
        ? { name: lookups.fileNames.get(value) ?? "" }
        : null;
    return { kind: "file", ...base, from: toRef(before), to: toRef(after) };
  }

  return { kind: "value", ...base, from: toJson(before), to: toJson(after) };
}
