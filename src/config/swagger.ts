import { DocumentBuilder } from "@nestjs/swagger";

export const swaggerConfig = new DocumentBuilder()
  .setTitle("Eventownik")
  .setDescription("Eventownik backend API documentation")
  .setVersion("3.0")
  .build();
