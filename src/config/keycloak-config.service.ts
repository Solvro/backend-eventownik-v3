import {
  KeycloakConnectOptions,
  KeycloakConnectOptionsFactory,
  PolicyEnforcementMode,
  TokenValidation,
} from "nest-keycloak-connect";

import { Injectable } from "@nestjs/common";

@Injectable()
export class KeycloakConfigService implements KeycloakConnectOptionsFactory {
  createKeycloakConnectOptions(): KeycloakConnectOptions {
    return {
      authServerUrl: process.env.KEYCLOAK_URL, //your URL Keycloak server
      realm: "solvro", //realms that used for this app
      clientId: process.env.KEYCLOAK_CLIENT_ID, //client id for this app
      secret: process.env.KEYCLOAK_SECRET ?? "", //secret for this app
      logLevels: ["verbose", "warn", "error"],
      useNestLogger: true,
      cookieKey: "keycloak-token",
      bearerOnly: false,
      policyEnforcement: PolicyEnforcementMode.PERMISSIVE,
      tokenValidation: TokenValidation.ONLINE,
    };
  }
}
