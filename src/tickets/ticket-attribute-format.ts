import type { Prisma } from "src/generated/prisma/client";
import { AttributeType } from "src/generated/prisma/enums";

import type { TicketScanAttribute } from "./entities/ticket-scan-result.entity";

export interface ShownAttribute {
  uuid: string;
  name: string;
  type: AttributeType;
}

export function toStringArray(
  value: Prisma.JsonValue | null | undefined,
): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

export function collectBlockUuids(
  shown: ShownAttribute[],
  valueOf: (attributeUuid: string) => Prisma.JsonValue,
): string[] {
  return shown
    .filter((attribute) => attribute.type === AttributeType.block)
    .flatMap((attribute) => toStringArray(valueOf(attribute.uuid)));
}

export function formatShownAttributes(
  shown: ShownAttribute[],
  valueOf: (attributeUuid: string) => Prisma.JsonValue,
  blockNames: Map<string, string>,
): TicketScanAttribute[] {
  return shown.map((attribute) => {
    const value = valueOf(attribute.uuid);
    return {
      attributeUuid: attribute.uuid,
      name: attribute.name,
      type: attribute.type,
      value,
      ...(attribute.type === AttributeType.block
        ? {
            blockNames: toStringArray(value)
              .map((uuid) => blockNames.get(uuid))
              .filter((name): name is string => name !== undefined),
          }
        : {}),
    };
  });
}
