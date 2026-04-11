import type { OrganizerType } from "src/generated/prisma/enums";

export function checkAdminType(admin: {
  type: OrganizerType;
  active: boolean;
}): boolean {
  return admin.type === "superadmin" && admin.active;
}
