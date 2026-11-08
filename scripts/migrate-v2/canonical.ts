import { createHash } from "node:crypto";

const VOLATILE_KEYS = new Set(["createdAt", "updatedAt"]);

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function hashPayload(payload: Record<string, unknown>): string {
  const stable = Object.fromEntries(
    Object.entries(payload).filter(([key]) => !VOLATILE_KEYS.has(key)),
  );
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(stable)))
    .digest("hex");
}
