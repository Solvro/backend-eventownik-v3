import type { AuthUser } from "src/auth/jwt.strategy";

import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";

import { adminActor } from "./audit-actor";
import type { AuditActor } from "./audit-log.types";

export const CurrentAuditActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuditActor => {
    const request = context.switchToHttp().getRequest<{
      user: Pick<AuthUser, "uuid" | "firstName" | "lastName">;
    }>();

    return adminActor(request.user);
  },
);
