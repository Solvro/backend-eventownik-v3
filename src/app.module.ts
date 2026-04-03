import * as Joi from "joi";

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AdminsModule } from "./admins/admins.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AttributesModule } from "./attributes/attributes.module";
import { AuthModule } from "./auth/auth.module";
import { BlocksModule } from "./blocks/blocks.module";
import { EventsModule } from "./events/events.module";
import { FormsModule } from "./forms/forms.module";
import { OrganizersModule } from "./organizers/organizers.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    FormsModule,
    ConfigModule.forRoot({
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        PORT: Joi.number().default(3000),
      }),
      isGlobal: true,
    }),
    OrganizersModule,
    AuthModule,
    AttributesModule,
    BlocksModule,
    AdminsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
