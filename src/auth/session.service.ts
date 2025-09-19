// src/auth/services/session.service.ts
import { Request } from "express";

import { Injectable } from "@nestjs/common";

import { AuthenticatedUser } from "./types/keycloak.types";

@Injectable()
export class SessionService {
  storeUserSession(
    request: Express.Request,
    user: AuthenticatedUser,
    accessToken: string,
    refreshToken?: string,
  ): void {
    request.session.user = {
      issuer: "keycloak",
      user,
      accessToken,
      refreshToken,
    };
  }

  getAccessToken(request: Request): string | null {
    return request.session.user?.accessToken ?? null;
  }

  getUser(request: Request): AuthenticatedUser | null {
    return request.session.user?.user ?? null;
  }

  async clearSession(request: Request): Promise<void> {
    return new Promise((resolve, reject) => {
      request.session.destroy((error: Error | null) => {
        if (error == null) {
          resolve();
        } else {
          reject(error);
        }
      });
    });
  }

  async saveSession(request: Express.Request): Promise<void> {
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
