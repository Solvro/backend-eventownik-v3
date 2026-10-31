import { AttributeType } from "src/generated/prisma/client";

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function parseListValue(raw: string): string[] {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim());
      }
    } catch {
      // not JSON, fall through to comma splitting
    }
  }
  return trimmed.split(",").map((item) => item.trim());
}

export function collectV2Values(
  type: AttributeType,
  rows: (string | null)[],
): string | string[] | null {
  const present = rows.filter(
    (value): value is string =>
      value !== null && value.trim() !== "" && value !== "null",
  );

  if (type === AttributeType.multiSelect || type === AttributeType.block) {
    const items = unique(
      present
        .flatMap((value) =>
          type === AttributeType.block
            ? value.split(",").map((item) => item.trim())
            : parseListValue(value),
        )
        .filter((item) => item !== ""),
    );
    return items.length === 0 ? null : items;
  }

  const distinct = unique(present);
  if (distinct.length > 1) {
    throw new Error("multiple values stored for a single-valued attribute");
  }
  return distinct[0] ?? null;
}
