import { Request } from "express";

import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

import { AuthenticatedUser } from "../types/keycloak.types";

@Injectable()
export class KeycloakAuthGuard extends AuthGuard("keycloak") {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Check if we have a session user first
    if (request.session.user?.user != null) {
      request.user = request.session.user.user; // Attach to request for passport
      return true;
    }

    // Check for bearer token
    const authHeader = request.headers.authorization ?? "";
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      request.headers.authorization = `Bearer ${token}`;
    }

    // Let passport handle the authentication
    try {
      const result = (await super.canActivate(context)) as boolean;

      // If passport authentication succeeded, store user in session
      if (result && request.user != null) {
        // request.session.user = {
        //   issuer: "keycloak",
        //   user: request.user as AuthenticatedUser,
        // };
        await this.saveSession(request);
      }

      return result;
    } catch {
      throw new UnauthorizedException("Authentication failed");
    }
  }

  private async saveSession(request: Request): Promise<void> {
    return new Promise((resolve, reject) => {
      request.session.save((error: Error | null) => {
        if (error == null) {
          resolve();
        } else {
          reject(error);
        }
      });
    });
  }
}
