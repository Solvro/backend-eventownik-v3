// src/auth/middlewares/auth-header.middleware.ts
import { NextFunction, Request } from "express";

import { Injectable, NestMiddleware } from "@nestjs/common";

import { SessionService } from "../session.service";

@Injectable()
export class AuthHeaderMiddleware implements NestMiddleware {
  constructor(private readonly sessionService: SessionService) {}

  use(request: Request, cos, next: NextFunction) {
    // Get token from session and add to authorization header
    const accessToken = this.sessionService.getAccessToken(request);

    if (accessToken != null && request.headers.authorization == null) {
      request.headers.authorization = `Bearer ${accessToken}`;
    }

    return next();
  }
}
