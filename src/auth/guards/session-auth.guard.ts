// src/auth/guards/session-auth.guard.ts
import { Request } from "express";

import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

import { SessionService } from "../session.service";

@Injectable()
export class SessionAuthGuard extends AuthGuard("keycloak") {
  constructor(private readonly sessionService: SessionService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Check if we have a valid session with token
    const accessToken = this.sessionService.getAccessToken(request);
    const user = this.sessionService.getUser(request);

    if (accessToken && user) {
      // Add authorization header for passport
      request.headers.authorization = `Bearer ${accessToken}`;
      request.user = user;
      return true;
    }

    // If no session, proceed with normal authentication
    try {
      return (await super.canActivate(context)) as boolean;
    } catch (error) {
      throw new UnauthorizedException("Authentication required");
    }
  }
}
