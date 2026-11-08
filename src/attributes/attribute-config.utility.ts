import { getJsonObject } from "src/common/utils/prisma.utility";
import type { Prisma } from "src/generated/prisma/client";

import { BadRequestException } from "@nestjs/common";

export function getConfigObject(
  config: Prisma.JsonValue | null | undefined,
): Record<string, unknown> | null {
  return getJsonObject(config);
}

export function getConfigStringArray(
  config: Record<string, unknown> | null,
  key: string,
): string[] {
  if (config == null) {
    return [];
  }

  const values = config[key];
  if (!Array.isArray(values)) {
    return [];
  }

  return values.filter(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );
}

export function getConfigStringArrayStrict(
  config: Record<string, unknown> | null,
  key: string,
): string[] | null {
  if (config == null) {
    return null;
  }

  const values = config[key];
  if (!Array.isArray(values)) {
    return null;
  }

  return values.filter(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );
}

export function getConfigBoolean(
  config: Record<string, unknown> | null,
  key: string,
): boolean {
  if (config == null) {
    return false;
  }

  return config[key] === true;
}

export function getConfigPositiveInteger(
  config: Record<string, unknown> | null,
  key: string,
  fallback?: number,
): number | undefined {
  if (config == null) {
    return fallback;
  }

  const value = config[key];
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return fallback;
  }

  return value;
}

export function getConfigPositiveIntegerStrict(
  config: Record<string, unknown> | null,
  key: string,
): number | undefined {
  if (config == null) {
    return undefined;
  }

  const value = config[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new BadRequestException(
      `Attribute config field ${key} must be a positive integer.`,
    );
  }

  return value;
}
