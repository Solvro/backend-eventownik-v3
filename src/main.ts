import type * as express from "express";
import * as qs from "qs";
import { swaggerConfig } from "src/config/swagger";

import { ValidationPipe, VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "3",
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      forbidUnknownValues: true,
    }),
  );

  const expressApp = app.getHttpAdapter().getInstance() as express.Application;

  expressApp.set("query parser", (string_: string) => qs.parse(string_));

  const documentFactory = () =>
    SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
