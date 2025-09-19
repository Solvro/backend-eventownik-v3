import type { AuthenticatedUser } from "../auth/types/keycloak.types";

declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}

    interface Request {
      user?: User;
      logout: (callback: (error: Error | null) => void) => void;
      session: Session & SessionData; // Combine Session and SessionData
    }
  }
}
