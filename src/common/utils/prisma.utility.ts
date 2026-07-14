import type { Prisma } from "src/generated/prisma/client";

type SortOrder = "asc" | "desc";

export function isJsonObject(
  value: Prisma.JsonValue | null | undefined,
): value is Prisma.JsonObject {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function getJsonObject(
  value: Prisma.JsonValue | null | undefined,
): Prisma.JsonObject | null {
  return isJsonObject(value) ? value : null;
}

export function parseSortInput(
  sort: string | undefined,
  allowedFields: string[],
) {
  if (sort === undefined || sort === "") {
    return [];
  }

  const results: Record<string, SortOrder>[] = [];

  for (const pair of sort.split(",")) {
    const [field, direction] = pair.split(":");

    if (allowedFields.includes(field)) {
      const validDirection: SortOrder = direction === "desc" ? "desc" : "asc";
      results.push({ [field]: validDirection });
    }
  }

  return results;
}
