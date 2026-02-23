import { PermissionType } from "src/generated/prisma/client";

import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { AuthUser } from "./jwt.strategy";
import { PERMISSIONS_KEY } from "./permissions.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<
      PermissionType[] | undefined
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (requiredPermissions === undefined) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      params: { eventId?: string };
      user?: AuthUser;
    }>();

    const user = request.user;
    const eventId = request.params.eventId;

    if (user?.permissions === undefined) {
      return false;
    }

    if (user.type === "superadmin") {
      return true;
    }

    const userEventPermissions = new Set(
      user.permissions
        .filter((p) => p.eventId === eventId)
        .map((p) => p.permission),
    );

    if (userEventPermissions.has(PermissionType.MANAGE_ALL)) {
      return true;
    }

    return requiredPermissions.some((permission) =>
      userEventPermissions.has(permission),
    );
  }
}
