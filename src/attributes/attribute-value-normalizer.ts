import { isEmail, isHexColor, isString, isUUID } from "class-validator";
import {
  getConfigBoolean,
  getConfigObject,
  getConfigPositiveInteger,
  getConfigStringArray,
} from "src/attributes/attribute-config.utility";
import { AttributeType, Prisma } from "src/generated/prisma/client";
import type { PrismaService } from "src/prisma/prisma.service";

import { BadRequestException } from "@nestjs/common";

const TEL_REGEX = /^\+?[0-9\s\-().]{6,20}$/;

export interface NormalizableAttribute {
  attributeUuid: string;
  type: AttributeType;
  config: Prisma.JsonValue | null;
}

type NormalizedValue = Prisma.InputJsonValue | typeof Prisma.JsonNull;

function isMissingValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function splitToStringArray(value: unknown): unknown[] | null {
  if (Array.isArray(value)) {
    return value as unknown[];
  }
  if (typeof value === "string") {
    return value.split(";");
  }
  return null;
}

function normalizeSelect(
  attribute: NormalizableAttribute,
  value: unknown,
): NormalizedValue {
  if (isMissingValue(value)) {
    return Prisma.JsonNull;
  }

  if (!isString(value)) {
    throw new BadRequestException(
      `Attribute ${attribute.attributeUuid} must be a string value.`,
    );
  }

  const configObject = getConfigObject(attribute.config);
  const options = getConfigStringArray(configObject, "options");
  const allowOther = getConfigBoolean(configObject, "allowOther");

  if (options.length === 0 && !allowOther) {
    throw new BadRequestException(
      `Attribute ${attribute.attributeUuid} has no selectable options.`,
    );
  }

  if (!allowOther && options.length > 0 && !options.includes(value)) {
    throw new BadRequestException(
      `Invalid value for attribute ${attribute.attributeUuid}. Allowed values are: ${options.join(", ")}`,
    );
  }

  return value;
}

function normalizeMultiSelect(
  attribute: NormalizableAttribute,
  value: unknown,
): NormalizedValue {
  if (isMissingValue(value)) {
    return Prisma.JsonNull;
  }

  const rawValues = splitToStringArray(value);
  if (rawValues == null) {
    throw new BadRequestException(
      `Attribute ${attribute.attributeUuid} must be a string array or a semicolon-separated string.`,
    );
  }

  const normalizedValues = rawValues.map((item) => {
    if (!isString(item)) {
      throw new BadRequestException(
        `Attribute ${attribute.attributeUuid} must contain only string values.`,
      );
    }
    return item.trim();
  });

  if (normalizedValues.some((item) => item.length === 0)) {
    throw new BadRequestException(
      `Attribute ${attribute.attributeUuid} cannot contain empty values.`,
    );
  }

  const configObject = getConfigObject(attribute.config);
  const options = getConfigStringArray(configObject, "options");
  const allowOther = getConfigBoolean(configObject, "allowOther");

  if (options.length === 0 && !allowOther) {
    throw new BadRequestException(
      `Attribute ${attribute.attributeUuid} has no selectable options.`,
    );
  }

  if (!allowOther && options.length > 0) {
    const invalidValue = normalizedValues.find(
      (item) => !options.includes(item),
    );
    if (invalidValue !== undefined) {
      throw new BadRequestException(
        `Invalid value for attribute ${attribute.attributeUuid}. Allowed values are: ${options.join(", ")}`,
      );
    }
  }

  const maxSelections = getConfigPositiveInteger(configObject, "maxSelections");
  if (maxSelections !== undefined && normalizedValues.length > maxSelections) {
    throw new BadRequestException(
      `Attribute ${attribute.attributeUuid} cannot contain more than ${String(maxSelections)} selections.`,
    );
  }

  return normalizedValues;
}

async function normalizeBlock(
  prisma: PrismaService,
  attribute: NormalizableAttribute,
  value: unknown,
): Promise<NormalizedValue> {
  if (isMissingValue(value)) {
    return Prisma.JsonNull;
  }

  const rawValues = splitToStringArray(value);
  if (rawValues == null) {
    throw new BadRequestException(
      `Attribute ${attribute.attributeUuid} must be an array of block UUIDs.`,
    );
  }

  const normalizedValues = rawValues.map((item) => {
    if (!isString(item)) {
      throw new BadRequestException(
        `Attribute ${attribute.attributeUuid} must contain only string values.`,
      );
    }

    const trimmedValue = item.trim();
    if (!isUUID(trimmedValue)) {
      throw new BadRequestException(
        `Attribute ${attribute.attributeUuid} must contain valid block UUIDs.`,
      );
    }

    return trimmedValue;
  });

  if (normalizedValues.length === 0) {
    return Prisma.JsonNull;
  }

  const maxSelections =
    getConfigPositiveInteger(
      getConfigObject(attribute.config),
      "maxSelections",
      1,
    ) ?? 1;

  if (normalizedValues.length > maxSelections) {
    throw new BadRequestException(
      `Attribute ${attribute.attributeUuid} cannot contain more than ${String(maxSelections)} selections.`,
    );
  }

  const existingBlocksCount = await prisma.block.count({
    where: {
      uuid: { in: normalizedValues },
      attributeUuid: attribute.attributeUuid,
    },
  });

  if (existingBlocksCount !== normalizedValues.length) {
    throw new BadRequestException(
      `One or more block UUIDs are invalid or do not exist for attribute ${attribute.attributeUuid}.`,
    );
  }

  return normalizedValues;
}

function normalizeNumber(
  attribute: NormalizableAttribute,
  value: unknown,
): NormalizedValue {
  if (isMissingValue(value)) {
    return Prisma.JsonNull;
  }

  const parsedValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (Number.isNaN(parsedValue)) {
    throw new BadRequestException(
      `Attribute ${attribute.attributeUuid} must be a valid number.`,
    );
  }

  return parsedValue;
}

function normalizeDate(
  attribute: NormalizableAttribute,
  value: unknown,
): NormalizedValue {
  if (isMissingValue(value)) {
    return Prisma.JsonNull;
  }

  const normalizedValue =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "string"
        ? value
        : null;

  if (normalizedValue == null || Number.isNaN(Date.parse(normalizedValue))) {
    throw new BadRequestException(
      `Attribute ${attribute.attributeUuid} must be a valid date/time format.`,
    );
  }

  return normalizedValue;
}

function normalizeCheckbox(
  attribute: NormalizableAttribute,
  value: unknown,
): NormalizedValue {
  if (isMissingValue(value)) {
    return Prisma.JsonNull;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }

  if (typeof value === "string") {
    const normalizedValue = value.toLowerCase();
    if (["true", "1", "on"].includes(normalizedValue)) {
      return true;
    }
    if (["false", "0", "off"].includes(normalizedValue)) {
      return false;
    }
  }

  throw new BadRequestException(
    `Attribute ${attribute.attributeUuid} must be a boolean value.`,
  );
}

function normalizeStringValue(
  attribute: NormalizableAttribute,
  value: unknown,
  formatCheck?: (stringValue: string) => boolean,
  formatDescription?: string,
): NormalizedValue {
  if (isMissingValue(value)) {
    return Prisma.JsonNull;
  }

  if (!isString(value)) {
    throw new BadRequestException(
      `Attribute ${attribute.attributeUuid} must be a string value.`,
    );
  }

  if (formatCheck != null && !formatCheck(value)) {
    throw new BadRequestException(
      `Attribute ${attribute.attributeUuid} must be ${formatDescription ?? "a valid value"}.`,
    );
  }

  return value;
}

export async function normalizeParticipantAttributeValue(
  prisma: PrismaService,
  attribute: NormalizableAttribute,
  value: unknown,
): Promise<NormalizedValue> {
  switch (attribute.type) {
    case AttributeType.select: {
      return normalizeSelect(attribute, value);
    }
    case AttributeType.multiSelect: {
      return normalizeMultiSelect(attribute, value);
    }
    case AttributeType.block: {
      return normalizeBlock(prisma, attribute, value);
    }
    case AttributeType.number: {
      return normalizeNumber(attribute, value);
    }
    case AttributeType.date:
    case AttributeType.datetime: {
      return normalizeDate(attribute, value);
    }
    case AttributeType.checkbox: {
      return normalizeCheckbox(attribute, value);
    }
    case AttributeType.email: {
      return normalizeStringValue(
        attribute,
        value,
        isEmail,
        "a valid email address",
      );
    }
    case AttributeType.tel: {
      return normalizeStringValue(
        attribute,
        value,
        (stringValue) => TEL_REGEX.test(stringValue),
        "a valid phone number",
      );
    }
    case AttributeType.color: {
      return normalizeStringValue(
        attribute,
        value,
        isHexColor,
        "a valid hex color",
      );
    }
    case AttributeType.text:
    case AttributeType.textArea:
    case AttributeType.file:
    case AttributeType.drawing:
    case AttributeType.time: {
      return normalizeStringValue(attribute, value);
    }
  }
}
