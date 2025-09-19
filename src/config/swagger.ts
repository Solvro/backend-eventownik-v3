import { DocumentBuilder } from "@nestjs/swagger";

export const swaggerConfig = new DocumentBuilder()
  .setTitle("Eventownik")
  .setDescription("Eventownik backend API documentation")
  .setVersion("3.0")
  .addBearerAuth(
    {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      name: "JWT",
      description: "Enter JWT token",
      in: "header",
    },
    "JWT-auth", // This name here is important for matching up with @ApiBearerAuth() in your controller!
  )
  .addOAuth2(
    {
      type: "oauth2",
      flows: {
        authorizationCode: {
          authorizationUrl: `${process.env.KEYCLOAK_URL ?? ""}/realms/${process.env.KEYCLOAK_REALM ?? ""}/protocol/openid-connect/auth`,
          tokenUrl: `${process.env.KEYCLOAK_URL ?? ""}/realms/${process.env.KEYCLOAK_REALM ?? ""}/protocol/openid-connect/token`,
          scopes: { openid: "OpenID", profile: "Profile", email: "Email" },
        },
      },
    },
    "keycloak-oauth", // This name should match the security requirement name
  )
  .build();
