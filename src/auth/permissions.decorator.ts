import type { PermissionType } from "src/generated/prisma/client";

import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "permissions";
export const RequirePermission = (...permissions: PermissionType[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const EVENT_PARAM_KEY = "eventParameterKey";
export const EventParameterKey = (key: string) =>
  SetMetadata(EVENT_PARAM_KEY, key);
