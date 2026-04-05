import type { OrganizerType } from "src/generated/prisma/enums";

export function checkAdminType(admin: { type: OrganizerType }): boolean {
  return admin.type === "superadmin";
}
