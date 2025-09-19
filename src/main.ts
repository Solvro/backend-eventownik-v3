import * as session from "express-session";
import * as passport from "passport";
import { swaggerConfig } from "src/config/swagger";

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe());

  app.use(
    session({
      secret: process.env.SESSION_SECRET ?? "fallback-secret-32-chars-minimum",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        // httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    }),
  );

  // Passport middleware
  app.use(passport.initialize());
  app.use(passport.session());

  const documentFactory = () =>
    SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup("docs", app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
