import { Observable } from "rxjs";
import { AuthUser } from "src/auth/jwt.strategy";

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: AuthUser;
    }>();

    const user = request.user;

    if (user?.type === "superadmin" && user.active) {
      return true;
    }

    throw new ForbiddenException(
      "Superadmin privileges are required to perform this action",
    );
  }
}
