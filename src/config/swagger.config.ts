import { DocumentBuilder } from "@nestjs/swagger";

export const swaggerConfig = new DocumentBuilder()
  .setTitle("Eventownik")
  .setDescription("Eventownik v3 backend API documentation")
  .setVersion("3.0")
  .build();
