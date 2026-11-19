import { EventsModule } from "src/events/events.module";
import { PrismaModule } from "src/prisma/prisma.module";
import { PrismaService } from "src/prisma/prisma.service";
import { StorageService } from "src/storage/storage.service";
import request from "supertest";
import type { App } from "supertest/types";

import type { INestApplication } from "@nestjs/common";
import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";

import { FormsModule } from "./forms.module";

const configValues: Record<string, string> = {
  FRONTEND_URL: "http://localhost:3000",
  S3_BUCKET_EVENTS: "events",
};

@Global()
@Module({
  providers: [
    {
      provide: ConfigService,
      useValue: {
        getOrThrow: (key: string) => configValues[key],
        get: (key: string) => configValues[key],
      },
    },
    {
      provide: StorageService,
      useValue: {
        getUrl: (bucket: string, key: string) => `s3/${bucket}/${key}`,
      },
    },
  ],
  exports: [ConfigService, StorageService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class FakeInfrastructureModule {}

const unique = () =>
  `${String(Date.now())}-${Math.random().toString(36).slice(2)}`;

describe("Public form openness over HTTP (integration)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const createdEventUuids: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        FakeInfrastructureModule,
        PrismaModule,
        EventEmitterModule.forRoot(),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1000 }]),
        EventsModule,
        FormsModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.event.deleteMany({
      where: { uuid: { in: createdEventUuids } },
    });
    await app.close();
    await prisma.$disconnect();
  });

  async function createEventWithRegisterForm(options: {
    participantsLimit: number;
    participantsCount: number;
    closeOnParticipantsLimit?: boolean;
  }) {
    const event = await prisma.event.create({
      data: {
        name: "Public form openness",
        slug: `form-openness-${unique()}`,
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-06-02"),
        isPublic: true,
        participantsLimit: options.participantsLimit,
      },
    });
    createdEventUuids.push(event.uuid);

    const form = await prisma.form.create({
      data: {
        name: "Register",
        eventUuid: event.uuid,
        isOpen: true,
        closeOnParticipantsLimit: options.closeOnParticipantsLimit,
      },
    });
    await prisma.event.update({
      where: { uuid: event.uuid },
      data: { registerFormUuid: form.uuid },
    });
    await prisma.participant.createMany({
      data: Array.from({ length: options.participantsCount }, (_, index) => ({
        email: `person-${String(index)}-${unique()}@example.com`,
        eventUuid: event.uuid,
      })),
    });

    return { event, form };
  }

  async function readIsCurrentlyOpen(eventSlug: string, formUuid: string) {
    const eventResponse = await request(app.getHttpServer()).get(
      `/public/events/${eventSlug}`,
    );
    const formResponse = await request(app.getHttpServer()).get(
      `/public/events/${eventSlug}/forms/${formUuid}`,
    );
    const eventBody = eventResponse.body as {
      registerForm: { isCurrentlyOpen: boolean };
    };
    const formBody = formResponse.body as { isCurrentlyOpen: boolean };
    return {
      onEvent: eventBody.registerForm.isCurrentlyOpen,
      onForm: formBody.isCurrentlyOpen,
    };
  }

  it("keeps the register form open below the participants limit", async () => {
    const { event, form } = await createEventWithRegisterForm({
      participantsLimit: 2,
      participantsCount: 1,
    });

    expect(await readIsCurrentlyOpen(event.slug, form.uuid)).toEqual({
      onEvent: true,
      onForm: true,
    });
  });

  it("closes the register form at the participants limit by default", async () => {
    const { event, form } = await createEventWithRegisterForm({
      participantsLimit: 2,
      participantsCount: 2,
    });

    expect(await readIsCurrentlyOpen(event.slug, form.uuid)).toEqual({
      onEvent: false,
      onForm: false,
    });
  });

  it("keeps the register form open at the limit when closeOnParticipantsLimit is false", async () => {
    const { event, form } = await createEventWithRegisterForm({
      participantsLimit: 2,
      participantsCount: 3,
      closeOnParticipantsLimit: false,
    });

    expect(await readIsCurrentlyOpen(event.slug, form.uuid)).toEqual({
      onEvent: true,
      onForm: true,
    });
  });
});
