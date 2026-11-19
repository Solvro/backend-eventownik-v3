import { AttributeType } from "src/generated/prisma/client";

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

const AFFIRMATIVE = new Set(["tak", "tak/yes", "yes"]);

function parseBraceList(trimmed: string): string[] {
  return trimmed
    .slice(1, -1)
    .split(",")
    .map((item) => item.trim().replace(/^"(.*)"$/, "$1"));
}

function parseListValue(raw: string): string[] {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return parseBraceList(trimmed);
  }
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

  const distinct = unique(
    type === AttributeType.checkbox
      ? present.map((value) =>
          AFFIRMATIVE.has(value.trim().toLowerCase()) ? "true" : value,
        )
      : present,
  );
  if (distinct.length > 1) {
    throw new Error("multiple values stored for a single-valued attribute");
  }
  return distinct[0] ?? null;
}
