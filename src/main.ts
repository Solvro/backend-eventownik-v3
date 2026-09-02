import cookieParser from "cookie-parser";
import * as express from "express";
import * as qs from "qs";
import { swaggerConfig } from "src/config/swagger.config";

import {
  ForbiddenException,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";
import { HcaptchaExceptionFilter } from "./common/exception-filters/hcaptcha.exception";

const BODY_SIZE_LIMIT = "15mb";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const configService = app.get(ConfigService);

  app.use(express.json({ limit: BODY_SIZE_LIMIT }));
  app.use(express.urlencoded({ limit: BODY_SIZE_LIMIT, extended: true }));

  app.setGlobalPrefix("api");
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "3",
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      forbidUnknownValues: true,
      whitelist: true,
    }),
  );

  app.useGlobalFilters(new HcaptchaExceptionFilter());

  const expressApp = app.getHttpAdapter().getInstance() as express.Application;

  expressApp.set("query parser", (string_: string) => qs.parse(string_));

  const documentFactory = () =>
    SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, documentFactory);

  const corsEntries = configService
    .getOrThrow<string>("CORS_ORIGINS")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const allowAll = corsEntries.includes("*");
  const exactOrigins = new Set(corsEntries.filter((o) => !o.startsWith("*.")));
  const wildcardDomains = corsEntries
    .filter((o) => o.startsWith("*."))
    .map((o) => o.slice(1));

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (origin === undefined) {
        callback(null, true);
        return;
      }
      if (allowAll) {
        callback(null, true);
        return;
      }
      if (exactOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      if (wildcardDomains.some((domain) => origin.endsWith(domain))) {
        callback(null, true);
        return;
      }
      callback(new ForbiddenException("Not allowed by CORS"), false);
    },
    credentials: true,
  });

  app.use(cookieParser());

  await app.listen(configService.getOrThrow<number>("PORT"));
}
bootstrap();
