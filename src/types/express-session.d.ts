import "express-session";

import type { AuthenticatedUser } from "../auth/types/keycloak.types";

declare module "express-session" {
  interface SessionData {
    user?: {
      issuer: string;
      user: AuthenticatedUser;
      accessToken: string;
      refreshToken?: string;
    };
  }
}
