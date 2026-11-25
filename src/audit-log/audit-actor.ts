import { LogTrigger } from "src/generated/prisma/client";

import type { AuditActor } from "./audit-log.types";

export function adminActor(admin: {
  uuid: string;
  firstName?: string | null;
  lastName?: string | null;
}): AuditActor {
  const name = [admin.firstName, admin.lastName]
    .filter((part) => part !== undefined && part !== null && part !== "")
    .join(" ");

  return {
    type: LogTrigger.ADMIN,
    uuid: admin.uuid,
    name: name === "" ? undefined : name,
  };
}

export function participantActor(participant: {
  uuid: string;
  email: string;
}): AuditActor {
  return {
    type: LogTrigger.PARTICIPANT,
    uuid: participant.uuid,
    name: participant.email,
  };
}

export const SYSTEM_ACTOR: AuditActor = { type: LogTrigger.SYSTEM };
