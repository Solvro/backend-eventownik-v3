import type { PermissionType } from "src/generated/prisma/client";

import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "permissions";
export const RequirePermission = (...permissions: PermissionType[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
