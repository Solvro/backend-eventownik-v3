import type { OrganizerType } from "src/generated/prisma/enums";

/**
 * @deprecated Use SuperAdminGuard instead
 */
export function checkAdminType(admin: {
  type: OrganizerType;
  active: boolean;
}): boolean {
  return admin.type === "superadmin" && admin.active;
}
