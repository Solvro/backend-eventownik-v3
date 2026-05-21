import type { PermissionType } from "src/generated/prisma/client";

import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "permissions";

export interface PermissionsMetadata {
  permissions: PermissionType[];
  eventKey?: string;
}

export const RequirePermission = (
  permissions: PermissionType | PermissionType[],
  eventKey?: string,
) =>
  SetMetadata(PERMISSIONS_KEY, {
    permissions: Array.isArray(permissions) ? permissions : [permissions],
    eventKey,
  } satisfies PermissionsMetadata);
