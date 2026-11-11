import {
  AttributeType,
  EmailStatus,
  EmailTrigger,
  OrganizerType,
  PermissionType,
} from "src/generated/prisma/client";

import type { V2Attribute } from "./types";

export class StructuralError extends Error {}

function lookup<T>(table: Map<string, T>, what: string, value: string): T {
  const mapped = table.get(value);
  if (mapped === undefined) {
    throw new StructuralError(`unknown ${what} "${value}"`);
  }
  return mapped;
}

const ATTRIBUTE_TYPES = new Map<string, AttributeType>([
  ["text", AttributeType.text],
  ["textarea", AttributeType.textArea],
  ["number", AttributeType.number],
  ["file", AttributeType.file],
  ["drawing", AttributeType.drawing],
  ["select", AttributeType.select],
  ["multiselect", AttributeType.multiSelect],
  ["block", AttributeType.block],
  ["date", AttributeType.date],
  ["time", AttributeType.time],
  ["datetime", AttributeType.datetime],
  ["email", AttributeType.email],
  ["tel", AttributeType.tel],
  ["color", AttributeType.color],
  ["checkbox", AttributeType.checkbox],
]);

const EMAIL_TRIGGERS = new Map<string, EmailTrigger>([
  ["participant_registered", EmailTrigger.PARTICIPANT_REGISTERED],
  ["participant_deleted", EmailTrigger.PARTICIPANT_DELETED],
  ["form_filled", EmailTrigger.FORM_FILLED],
  ["attribute_changed", EmailTrigger.ATTRIBUTE_CHANGED],
  ["manual", EmailTrigger.MANUAL],
]);

const PERMISSIONS = new Map<string, PermissionType>([
  ["manage:all", PermissionType.MANAGE_ALL],
  ["manage:event", PermissionType.MANAGE_EVENT],
  ["manage:setting", PermissionType.MANAGE_SETTINGS],
  ["manage:form", PermissionType.MANAGE_FORM],
  ["manage:participant", PermissionType.MANAGE_PARTICIPANT],
  ["manage:email", PermissionType.MANAGE_EMAIL],
]);

const ADMIN_TYPES = new Map<string, OrganizerType>([
  ["organizer", OrganizerType.organizer],
  ["superadmin", OrganizerType.superadmin],
]);

const EMAIL_STATUSES = new Map<string, EmailStatus>([
  ["pending", EmailStatus.pending],
  ["sent", EmailStatus.sent],
  ["failed", EmailStatus.failed],
]);

export const mapAttributeType = (v2Type: string) =>
  lookup(ATTRIBUTE_TYPES, "attribute type", v2Type);

export const mapEmailTrigger = (v2Trigger: string) =>
  lookup(EMAIL_TRIGGERS, "email trigger", v2Trigger);

export const mapPermission = (action: string, subject: string) =>
  lookup(PERMISSIONS, "permission", `${action}:${subject}`);

export const mapAdminType = (v2Type: string) =>
  lookup(ADMIN_TYPES, "admin type", v2Type);

export const mapEmailStatus = (v2Status: string) =>
  lookup(EMAIL_STATUSES, "email status", v2Status);

export function parseOptions(raw: unknown): string[] {
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

export function buildAttributeConfig(
  attribute: V2Attribute,
  type: AttributeType,
  blockCount: number,
): Record<string, unknown> {
  if (type === AttributeType.select) {
    return {
      options: parseOptions(attribute.options),
      allowOther: attribute.allow_other,
    };
  }
  if (type === AttributeType.multiSelect) {
    return {
      options: parseOptions(attribute.options),
      allowOther: attribute.allow_other,
      ...(attribute.max_selections === null
        ? {}
        : { maxSelections: attribute.max_selections }),
    };
  }
  if (type === AttributeType.block) {
    // v2 allowed unlimited selections, v3 needs a number: picking every block is equivalent
    const multipleLimit = attribute.max_selections ?? Math.max(1, blockCount);
    return { maxSelections: attribute.is_multiple ? multipleLimit : 1 };
  }
  return {};
}

const MARKDOWN_LINK = /^\[([^\]]*)\]\((\S+)\)$/;

export function parseLink(raw: string): { url: string; label: string | null } {
  const trimmed = raw.trim();
  const match = MARKDOWN_LINK.exec(trimmed);
  if (match === null) {
    return { url: trimmed, label: null };
  }
  const label = match[1].trim();
  return { url: match[2], label: label === "" ? null : label };
}
