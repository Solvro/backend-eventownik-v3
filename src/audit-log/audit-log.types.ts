import type {
  AttributeType,
  LogTrigger,
  Prisma,
} from "src/generated/prisma/client";

import type {
  AuditActionCode,
  AuditEntityTypeCode,
} from "./audit-log.constants";

export interface AuditActor {
  type: LogTrigger;
  uuid?: string;
  name?: string;
}

export interface AuditAttributeRef {
  uuid: string;
  name: string;
  type: AttributeType;
}

export interface AuditBlockRef {
  uuid: string;
  name: string;
}

export interface AuditFileRef {
  name: string;
}

interface AuditChangeBase {
  field: string;
  attribute?: AuditAttributeRef;
}

export interface AuditValueChange extends AuditChangeBase {
  kind: "value";
  from: Prisma.JsonValue;
  to: Prisma.JsonValue;
}

export interface AuditListChange extends AuditChangeBase {
  kind: "list";
  added: Prisma.JsonValue[];
  removed: Prisma.JsonValue[];
}

export interface AuditBlocksChange extends AuditChangeBase {
  kind: "blocks";
  added: AuditBlockRef[];
  removed: AuditBlockRef[];
}

export interface AuditFileChange extends AuditChangeBase {
  kind: "file";
  from: AuditFileRef | null;
  to: AuditFileRef | null;
}

export interface AuditOpaqueChange extends AuditChangeBase {
  kind: "changed";
}

export type AuditChange =
  | AuditValueChange
  | AuditListChange
  | AuditBlocksChange
  | AuditFileChange
  | AuditOpaqueChange;

export interface AuditEntry {
  eventUuid: string;
  action: AuditActionCode;
  actor: AuditActor;
  entityType: AuditEntityTypeCode;
  entityUuid?: string;
  entityLabel?: string;
  changes?: AuditChange[];
  correlationId?: string;
}
