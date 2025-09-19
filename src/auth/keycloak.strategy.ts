/* eslint-disable @typescript-eslint/restrict-template-expressions */
// src/auth/strategies/keycloak.strategy.ts
import { Strategy } from "passport-openidconnect";

import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";

import { SessionService } from "./session.service";
import { AuthenticatedUser, KeycloakProfile } from "./types/keycloak.types";

interface KeycloakAuthResult {
  issuer: string;
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken?: string;
}

@Injectable()
export class KeycloakStrategy extends PassportStrategy(Strategy, "keycloak") {
  constructor(private sessionService: SessionService) {
    super({
      issuer: process.env.KEYCLOAK_ISSUER ?? "",
      authorizationURL: `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/auth`,
      tokenURL: `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`,
      userInfoURL: `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/userinfo`,
      clientID: process.env.KEYCLOAK_CLIENT_ID ?? "",
      clientSecret: process.env.KEYCLOAK_SECRET ?? "",
      callbackURL: process.env.KEYCLOAK_CALLBACK_URL ?? "",
      scope: "openid profile email",
      passReqToCallback: true, // Important to get request object
    });
  }

  async validate(
    request: Express.Request,
    issuer: string,
    profile: KeycloakProfile,
    done: (error: Error | null, result?: KeycloakAuthResult) => void,
  ): Promise<void> {
    try {
      const user = this.mapProfileToUser(profile);

      // Get tokens from request (they're added by passport-openidconnect)
      const accessToken = (request as any)._oauthToken?.access_token;
      const refreshToken = (request as any)._oauthToken?.refresh_token;

      console.log(accessToken);
      console.log(refreshToken);

      if (!accessToken) {
        throw new Error("No access token received");
      }

      // Store in session
      this.sessionService.storeUserSession(
        request,
        user,
        accessToken,
        refreshToken,
      );
      await this.sessionService.saveSession(request);

      done(null, { issuer, user, accessToken, refreshToken });
    } catch (error) {
      done(error instanceof Error ? error : new Error("Validation failed"));
    }
  }

  private mapProfileToUser(profile: KeycloakProfile): AuthenticatedUser {
    const { _json, emails, name } = profile;

    return {
      id: _json.sub,
      email: emails?.[0]?.value || _json.email || "",
      firstName: name?.givenName || _json.given_name || "",
      lastName: name?.familyName || _json.family_name || "",
      username: _json.preferred_username || "",
      roles: this.extractRoles(_json),
      emailVerified: _json.email_verified || false,
    };
  }

  private extractRoles(json: KeycloakProfile["_json"]): string[] {
    const roles: string[] = [];

    if (json.realm_access?.roles) {
      roles.push(...json.realm_access.roles);
    }

    if (json.resource_access) {
      Object.values(json.resource_access).forEach((client) => {
        if (client?.roles) {
          roles.push(...client.roles);
        }
      });
    }

    return [...new Set(roles)];
  }
}
