// src/auth/types/keycloak.types.ts
export interface KeycloakUser {
  sub: string;
  email?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  email_verified?: boolean;
  realm_access?: {
    roles?: string[];
  };
  resource_access?: Record<
    string,
    {
      roles?: string[];
    }
  >;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  roles: string[];
  emailVerified: boolean;
}

export interface KeycloakConfig {
  authServerUrl: string;
  realm: string;
  clientId: string;
  secret: string;
}

// src/auth/types/keycloak.types.ts
export interface KeycloakProfile {
  // Standard OpenID Connect claims
  id: string; // User ID (sub claim)
  displayName?: string; // Display name
  name?: {
    // Structured name
    givenName?: string; // First name
    familyName?: string; // Last name
    middleName?: string; // Middle name
  };
  emails?: Array<{
    // Email addresses
    value: string; // Email address
    verified?: boolean; // Email verification status
  }>;
  photos?: Array<{
    // Profile photos
    value: string; // Photo URL
  }>;
  provider: string; // Authentication provider ('keycloak')

  // Raw data from Keycloak
  _raw: string; // Raw JSON string response
  _json: {
    // Parsed JSON object
    // Standard OIDC claims
    sub: string; // Subject identifier (user ID)
    name?: string; // Full name
    given_name?: string; // First name
    family_name?: string; // Last name
    preferred_username?: string; // Username
    email?: string; // Email address
    email_verified?: boolean; // Email verification status

    // Keycloak-specific claims
    realm_access?: {
      // Realm-level roles
      roles?: string[];
    };
    resource_access?: {
      // Client-specific roles
      [clientId: string]: {
        // Key is the client ID
        roles?: string[];
      };
    };

    // Other standard claims
    iat?: number; // Issued at timestamp
    exp?: number; // Expiration timestamp
    iss?: string; // Issuer URL
    aud?: string | string[]; // Audience
    azp?: string; // Authorized party
  };
}
