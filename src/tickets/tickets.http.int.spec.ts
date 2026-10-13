import { JwtStrategy } from "src/auth/jwt.strategy";
import { PermissionType } from "src/generated/prisma/enums";
import { PrismaModule } from "src/prisma/prisma.module";
import { PrismaService } from "src/prisma/prisma.service";
import { StorageService } from "src/storage/storage.service";
import request from "supertest";
import type { App } from "supertest/types";

import type { INestApplication } from "@nestjs/common";
import { Global, Module, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";

import { TicketsModule } from "./tickets.module";

const JWT_SECRET = "tickets-http-int-secret";

const configValues: Record<string, string> = {
  JWT_SECRET,
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

function bodyOf(response: { body: unknown }): Record<string, unknown> {
  return response.body as Record<string, unknown>;
}

interface ParticipantsPage {
  data: Record<string, unknown>[];
  meta: Record<string, unknown>;
}

function pageOf(response: { body: unknown }): ParticipantsPage {
  return response.body as ParticipantsPage;
}

const emailsOf = (response: { body: unknown }) =>
  (bodyOf(response).data as { email: string }[]).map((row) => row.email);

const uuidOf = (response: { body: unknown }) => bodyOf(response).uuid as string;

const statusOf = (response: { status: number }) => response.status;

const unique = () =>
  `${String(Date.now())}-${Math.random().toString(36).slice(2)}`;

describe("Tickets module over HTTP (integration)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;

  const createdEventUuids: string[] = [];
  const createdAdminUuids: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        FakeInfrastructureModule,
        PrismaModule,
        PassportModule,
        JwtModule.register({ secret: JWT_SECRET }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1000 }]),
        TicketsModule,
      ],
      providers: [JwtStrategy],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        forbidUnknownValues: true,
        whitelist: true,
      }),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);
    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await prisma.event.deleteMany({
      where: { uuid: { in: createdEventUuids } },
    });
    await prisma.admin.deleteMany({
      where: { uuid: { in: createdAdminUuids } },
    });
    await app.close();
    await prisma.$disconnect();
  });

  async function createEvent() {
    const event = await prisma.event.create({
      data: {
        name: "HTTP Ticket Fest",
        slug: `tickets-http-${unique()}`,
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-06-02"),
      },
    });
    createdEventUuids.push(event.uuid);
    return event;
  }

  async function createAdminToken(
    permissions: { eventUuid: string; permission: PermissionType }[],
    type: "organizer" | "superadmin" = "organizer",
  ) {
    const admin = await prisma.admin.create({
      data: {
        firstName: "Test",
        lastName: "Admin",
        password: "x",
        type,
        email: `tickets-http-${unique()}@example.com`,
        permissions: { create: permissions },
      },
    });
    createdAdminUuids.push(admin.uuid);
    return {
      admin,
      bearer: `Bearer ${jwt.sign({ sub: admin.uuid, email: admin.email })}`,
    };
  }

  async function createWorkshopEvent() {
    const event = await createEvent();
    const blockAttribute = await prisma.attribute.create({
      data: {
        eventUuid: event.uuid,
        type: "block",
        name: "Workshops",
        order: 1,
      },
    });
    const textAttribute = await prisma.attribute.create({
      data: { eventUuid: event.uuid, type: "text", name: "Diet", order: 2 },
    });
    const fileAttribute = await prisma.attribute.create({
      data: { eventUuid: event.uuid, type: "file", name: "CV", order: 3 },
    });
    const root = await prisma.block.create({
      data: {
        name: "root",
        attributeUuid: blockAttribute.uuid,
        isRootBlock: true,
      },
    });
    const workshopA = await prisma.block.create({
      data: {
        name: "Workshop A",
        attributeUuid: blockAttribute.uuid,
        parentUuid: root.uuid,
      },
    });
    const workshopB = await prisma.block.create({
      data: {
        name: "Workshop B",
        attributeUuid: blockAttribute.uuid,
        parentUuid: root.uuid,
      },
    });
    const participantIn = async (email: string, blocks: string[]) =>
      await prisma.participant.create({
        data: {
          email,
          eventUuid: event.uuid,
          attributes: {
            create: [
              { attributeUuid: blockAttribute.uuid, value: blocks },
              { attributeUuid: textAttribute.uuid, value: "vegan" },
            ],
          },
        },
      });
    return {
      event,
      blockAttribute,
      textAttribute,
      fileAttribute,
      workshopA,
      workshopB,
      participantIn,
    };
  }

  describe("authentication and permissions", () => {
    it("rejects requests without a token with 401", async () => {
      const event = await createEvent();

      await request(app.getHttpServer())
        .get(`/events/${event.uuid}/tickets`)
        .expect(401);
      await request(app.getHttpServer())
        .post(`/events/${event.uuid}/tickets`)
        .send({ mode: "EVENT" })
        .expect(401);
    });

    it("lets SCAN_TICKET read but not manage tickets", async () => {
      const event = await createEvent();
      const { bearer } = await createAdminToken([
        { eventUuid: event.uuid, permission: PermissionType.SCAN_TICKET },
      ]);

      await request(app.getHttpServer())
        .get(`/events/${event.uuid}/tickets`)
        .set("Authorization", bearer)
        .expect(200);
      await request(app.getHttpServer())
        .post(`/events/${event.uuid}/tickets`)
        .set("Authorization", bearer)
        .send({ mode: "EVENT" })
        .expect(403);
    });

    it("lets MANAGE_TICKET manage but not scan", async () => {
      const { event, participantIn } = await createWorkshopEvent();
      const { bearer } = await createAdminToken([
        { eventUuid: event.uuid, permission: PermissionType.MANAGE_TICKET },
      ]);
      const participant = await participantIn("manage@example.com", []);

      const created = await request(app.getHttpServer())
        .post(`/events/${event.uuid}/tickets`)
        .set("Authorization", bearer)
        .send({ mode: "EVENT" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/events/${event.uuid}/tickets/${uuidOf(created)}/scan`)
        .set("Authorization", bearer)
        .send({ token: participant.ticketToken })
        .expect(403);
    });

    it("scopes permissions to the event", async () => {
      const event = await createEvent();
      const otherEvent = await createEvent();
      const { bearer } = await createAdminToken([
        {
          eventUuid: otherEvent.uuid,
          permission: PermissionType.MANAGE_TICKET,
        },
      ]);

      await request(app.getHttpServer())
        .post(`/events/${event.uuid}/tickets`)
        .set("Authorization", bearer)
        .send({ mode: "EVENT" })
        .expect(403);
    });

    it("lets MANAGE_ALL and superadmins through", async () => {
      const event = await createEvent();
      const manageAll = await createAdminToken([
        { eventUuid: event.uuid, permission: PermissionType.MANAGE_ALL },
      ]);
      const otherEvent = await createEvent();
      const superadmin = await createAdminToken([], "superadmin");

      await request(app.getHttpServer())
        .post(`/events/${event.uuid}/tickets`)
        .set("Authorization", manageAll.bearer)
        .send({ mode: "EVENT" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/events/${otherEvent.uuid}/tickets`)
        .set("Authorization", superadmin.bearer)
        .send({ mode: "EVENT" })
        .expect(201);
    });
  });

  describe("ticket configuration", () => {
    it("validates the request body", async () => {
      const { event } = await createWorkshopEvent();
      const { bearer } = await createAdminToken([
        { eventUuid: event.uuid, permission: PermissionType.MANAGE_TICKET },
      ]);
      const post = async (body: object) =>
        await request(app.getHttpServer())
          .post(`/events/${event.uuid}/tickets`)
          .set("Authorization", bearer)
          .send(body);

      expect(statusOf(await post({ mode: "NOPE" }))).toBe(400);
      expect(statusOf(await post({ mode: "BLOCK" }))).toBe(400);
      expect(
        statusOf(
          await post({ mode: "EVENT", shownAttributeUuids: ["not-a-uuid"] }),
        ),
      ).toBe(400);
      expect(statusOf(await post({ mode: "EVENT", extra: true }))).toBe(201);
    });

    it("runs the full lifecycle of a BLOCK ticket", async () => {
      const { event, blockAttribute, textAttribute, fileAttribute } =
        await createWorkshopEvent();
      const manager = await createAdminToken([
        { eventUuid: event.uuid, permission: PermissionType.MANAGE_TICKET },
      ]);
      const base = `/events/${event.uuid}/tickets`;

      await request(app.getHttpServer())
        .post(base)
        .set("Authorization", manager.bearer)
        .send({
          mode: "BLOCK",
          attributeUuid: blockAttribute.uuid,
          shownAttributeUuids: [fileAttribute.uuid],
        })
        .expect(400);

      const created = await request(app.getHttpServer())
        .post(base)
        .set("Authorization", manager.bearer)
        .send({
          mode: "BLOCK",
          attributeUuid: blockAttribute.uuid,
          shownAttributeUuids: [textAttribute.uuid],
        })
        .expect(201);
      const ticketUuid = uuidOf(created);
      expect(created.body).toMatchObject({
        eventUuid: event.uuid,
        mode: "BLOCK",
        attributeUuid: blockAttribute.uuid,
        shownAttributeUuids: [textAttribute.uuid],
      });

      await request(app.getHttpServer())
        .post(base)
        .set("Authorization", manager.bearer)
        .send({ mode: "BLOCK", attributeUuid: blockAttribute.uuid })
        .expect(409);

      const patched = await request(app.getHttpServer())
        .patch(`${base}/${ticketUuid}`)
        .set("Authorization", manager.bearer)
        .send({
          shownAttributeUuids: [textAttribute.uuid, blockAttribute.uuid],
        })
        .expect(200);
      expect(
        (bodyOf(patched).shownAttributeUuids as string[]).toSorted(),
      ).toEqual([textAttribute.uuid, blockAttribute.uuid].toSorted());

      const list = await request(app.getHttpServer())
        .get(base)
        .set("Authorization", manager.bearer)
        .expect(200);
      expect(list.body).toHaveLength(1);

      await request(app.getHttpServer())
        .delete(`${base}/${ticketUuid}`)
        .set("Authorization", manager.bearer)
        .expect(204);
      await request(app.getHttpServer())
        .get(`${base}/${ticketUuid}`)
        .set("Authorization", manager.bearer)
        .expect(404);
    });

    it("does not expose another event's ticket", async () => {
      const { event } = await createWorkshopEvent();
      const otherEvent = await createEvent();
      const manager = await createAdminToken([
        { eventUuid: event.uuid, permission: PermissionType.MANAGE_TICKET },
        {
          eventUuid: otherEvent.uuid,
          permission: PermissionType.MANAGE_TICKET,
        },
      ]);
      const created = await request(app.getHttpServer())
        .post(`/events/${event.uuid}/tickets`)
        .set("Authorization", manager.bearer)
        .send({ mode: "EVENT" })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/events/${otherEvent.uuid}/tickets/${uuidOf(created)}`)
        .set("Authorization", manager.bearer)
        .expect(404);
    });
  });

  describe("scanning and confirming", () => {
    it("runs the door flow for a BLOCK ticket", async () => {
      const {
        event,
        blockAttribute,
        textAttribute,
        workshopA,
        workshopB,
        participantIn,
      } = await createWorkshopEvent();
      const manager = await createAdminToken([
        { eventUuid: event.uuid, permission: PermissionType.MANAGE_TICKET },
      ]);
      const door = await createAdminToken([
        { eventUuid: event.uuid, permission: PermissionType.SCAN_TICKET },
      ]);
      const attendee = await participantIn("attendee@example.com", [
        workshopA.uuid,
        workshopB.uuid,
      ]);
      const created = await request(app.getHttpServer())
        .post(`/events/${event.uuid}/tickets`)
        .set("Authorization", manager.bearer)
        .send({
          mode: "BLOCK",
          attributeUuid: blockAttribute.uuid,
          shownAttributeUuids: [textAttribute.uuid, blockAttribute.uuid],
        })
        .expect(201);
      const base = `/events/${event.uuid}/tickets/${uuidOf(created)}`;
      const body = { token: attendee.ticketToken, blockUuid: workshopA.uuid };

      const scanned = await request(app.getHttpServer())
        .post(`${base}/scan`)
        .set("Authorization", door.bearer)
        .send(body)
        .expect(200);
      expect(scanned.body).toMatchObject({
        status: "VALID",
        participant: { uuid: attendee.uuid, email: "attendee@example.com" },
      });
      const shown = bodyOf(scanned).attributes as {
        name: string;
        blockNames?: string[];
      }[];
      expect(shown.map((a) => a.name)).toEqual(["Workshops", "Diet"]);
      expect(shown[0].blockNames).toEqual(["Workshop A", "Workshop B"]);

      const confirmed = await request(app.getHttpServer())
        .post(`${base}/check-ins`)
        .set("Authorization", door.bearer)
        .send(body)
        .expect(201);
      expect(confirmed.body).toMatchObject({
        participantUuid: attendee.uuid,
        blockUuid: workshopA.uuid,
      });
      expect(confirmed.body).not.toHaveProperty("confirmedByAdminUuid");

      const stored = await prisma.ticketCheckIn.findFirst({
        where: { participantUuid: attendee.uuid },
      });
      expect(stored?.confirmedByAdminUuid).toBe(door.admin.uuid);

      const duplicate = await request(app.getHttpServer())
        .post(`${base}/check-ins`)
        .set("Authorization", door.bearer)
        .send(body)
        .expect(409);
      expect(duplicate.body).toMatchObject({ status: "ALREADY_CONFIRMED" });

      const rescanned = await request(app.getHttpServer())
        .post(`${base}/scan`)
        .set("Authorization", door.bearer)
        .send(body)
        .expect(200);
      expect(rescanned.body).toMatchObject({ status: "ALREADY_CONFIRMED" });
      expect(rescanned.body).toHaveProperty("confirmedAt");
      expect(rescanned.body).not.toHaveProperty("confirmedByAdminUuid");

      const otherBlock = await request(app.getHttpServer())
        .post(`${base}/scan`)
        .set("Authorization", door.bearer)
        .send({ token: attendee.ticketToken, blockUuid: workshopB.uuid })
        .expect(200);
      expect(otherBlock.body).toMatchObject({ status: "VALID" });
    });

    it("answers the failure outcomes with the agreed shapes", async () => {
      const { event, workshopA, workshopB, blockAttribute, participantIn } =
        await createWorkshopEvent();
      const otherEvent = await createEvent();
      const outsider = await prisma.participant.create({
        data: {
          email: `outsider-${unique()}@example.com`,
          eventUuid: otherEvent.uuid,
        },
      });
      const door = await createAdminToken([
        { eventUuid: event.uuid, permission: PermissionType.MANAGE_ALL },
      ]);
      const inB = await participantIn("inb@example.com", [workshopB.uuid]);
      const created = await request(app.getHttpServer())
        .post(`/events/${event.uuid}/tickets`)
        .set("Authorization", door.bearer)
        .send({ mode: "BLOCK", attributeUuid: blockAttribute.uuid })
        .expect(201);
      const base = `/events/${event.uuid}/tickets/${uuidOf(created)}`;
      const scan = async (body: object) =>
        await request(app.getHttpServer())
          .post(`${base}/scan`)
          .set("Authorization", door.bearer)
          .send(body);

      const unknown = await scan({ token: "nope", blockUuid: workshopA.uuid });
      expect(unknown.status).toBe(200);
      expect(unknown.body).toEqual({ status: "INVALID_TICKET" });

      const wrongEvent = await scan({
        token: outsider.ticketToken,
        blockUuid: workshopA.uuid,
      });
      expect(wrongEvent.status).toBe(200);
      expect(wrongEvent.body).toEqual({ status: "WRONG_EVENT" });

      const wrongBlock = await scan({
        token: inB.ticketToken,
        blockUuid: workshopA.uuid,
      });
      expect(wrongBlock.status).toBe(200);
      expect(wrongBlock.body).toEqual({
        status: "WRONG_BLOCK",
        blockNames: ["Workshop B"],
      });

      expect(statusOf(await scan({ token: inB.ticketToken }))).toBe(400);
      expect(
        statusOf(
          await scan({ token: inB.ticketToken, blockUuid: "not-a-uuid" }),
        ),
      ).toBe(400);
      expect(statusOf(await scan({}))).toBe(400);

      const refused = await request(app.getHttpServer())
        .post(`${base}/check-ins`)
        .set("Authorization", door.bearer)
        .send({ token: inB.ticketToken, blockUuid: workshopA.uuid })
        .expect(422);
      expect(refused.body).toMatchObject({ status: "WRONG_BLOCK" });
      expect(
        await prisma.ticketCheckIn.count({
          where: { participantUuid: inB.uuid },
        }),
      ).toBe(0);
    });

    it("lets only one of several concurrent confirms through", async () => {
      const event = await createEvent();
      const door = await createAdminToken([
        { eventUuid: event.uuid, permission: PermissionType.SCAN_TICKET },
      ]);
      const manager = await createAdminToken([
        { eventUuid: event.uuid, permission: PermissionType.MANAGE_TICKET },
      ]);
      const participant = await prisma.participant.create({
        data: { email: `race-${unique()}@example.com`, eventUuid: event.uuid },
      });
      const created = await request(app.getHttpServer())
        .post(`/events/${event.uuid}/tickets`)
        .set("Authorization", manager.bearer)
        .send({ mode: "EVENT" })
        .expect(201);
      const url = `/events/${event.uuid}/tickets/${uuidOf(created)}/check-ins`;

      const responses = await Promise.all(
        [1, 2, 3, 4].map(async () =>
          request(app.getHttpServer())
            .post(url)
            .set("Authorization", door.bearer)
            .send({ token: participant.ticketToken }),
        ),
      );

      expect(responses.map((r) => r.status).toSorted((a, b) => a - b)).toEqual([
        201, 409, 409, 409,
      ]);
      expect(
        await prisma.ticketCheckIn.count({
          where: { participantUuid: participant.uuid },
        }),
      ).toBe(1);
    });
  });

  describe("participants list", () => {
    it("serves a filtered, paginated list with attendance", async () => {
      const { event, blockAttribute, textAttribute, workshopA, participantIn } =
        await createWorkshopEvent();
      const manager = await createAdminToken([
        { eventUuid: event.uuid, permission: PermissionType.MANAGE_TICKET },
      ]);
      const door = await createAdminToken([
        { eventUuid: event.uuid, permission: PermissionType.SCAN_TICKET },
      ]);
      const first = await participantIn("anna@example.com", [workshopA.uuid]);
      await participantIn("zofia@example.com", [workshopA.uuid]);
      await participantIn("nobody@example.com", []);
      const created = await request(app.getHttpServer())
        .post(`/events/${event.uuid}/tickets`)
        .set("Authorization", manager.bearer)
        .send({
          mode: "BLOCK",
          attributeUuid: blockAttribute.uuid,
          shownAttributeUuids: [textAttribute.uuid],
        })
        .expect(201);
      const base = `/events/${event.uuid}/tickets/${uuidOf(created)}`;
      await request(app.getHttpServer())
        .post(`${base}/check-ins`)
        .set("Authorization", door.bearer)
        .send({ token: first.ticketToken, blockUuid: workshopA.uuid })
        .expect(201);

      const all = await request(app.getHttpServer())
        .get(`${base}/participants`)
        .query({ blockUuid: workshopA.uuid })
        .set("Authorization", door.bearer)
        .expect(200);
      const allPage = pageOf(all);
      expect(emailsOf(all)).toEqual(["anna@example.com", "zofia@example.com"]);
      expect(allPage.meta).toMatchObject({ itemCount: 2 });
      expect(allPage.data[0]).toMatchObject({
        attendance: { confirmed: true },
        attributes: [{ name: "Diet", value: "vegan" }],
      });
      expect(allPage.data[0]).not.toHaveProperty("createdAt");

      const unconfirmed = await request(app.getHttpServer())
        .get(`${base}/participants`)
        .query({ blockUuid: workshopA.uuid, confirmed: "false" })
        .set("Authorization", door.bearer)
        .expect(200);
      expect(emailsOf(unconfirmed)).toEqual(["zofia@example.com"]);

      const paged = await request(app.getHttpServer())
        .get(`${base}/participants`)
        .query({ blockUuid: workshopA.uuid, take: 1, page: 2 })
        .set("Authorization", door.bearer)
        .expect(200);
      const pagedPage = pageOf(paged);
      expect(pagedPage.data).toHaveLength(1);
      expect(pagedPage.meta).toMatchObject({ page: 2, hasNextPage: false });

      await request(app.getHttpServer())
        .get(`${base}/participants`)
        .query({ blockUuid: workshopA.uuid, confirmed: "maybe" })
        .set("Authorization", door.bearer)
        .expect(400);
      await request(app.getHttpServer())
        .get(`${base}/participants`)
        .set("Authorization", door.bearer)
        .expect(400);
    });
  });

  describe("public ticket page", () => {
    it("serves the ticket page without authentication", async () => {
      const event = await createEvent();
      const manager = await createAdminToken([
        { eventUuid: event.uuid, permission: PermissionType.MANAGE_TICKET },
      ]);
      const participant = await prisma.participant.create({
        data: { email: `pub-${unique()}@example.com`, eventUuid: event.uuid },
      });

      await request(app.getHttpServer())
        .get(`/public/events/${event.slug}/tickets/${participant.ticketToken}`)
        .expect(404);

      await request(app.getHttpServer())
        .post(`/events/${event.uuid}/tickets`)
        .set("Authorization", manager.bearer)
        .send({ mode: "EVENT" })
        .expect(201);

      const page = await request(app.getHttpServer())
        .get(`/public/events/${event.slug}/tickets/${participant.ticketToken}`)
        .expect(200);
      expect(page.body).toMatchObject({
        token: participant.ticketToken,
        event: { name: "HTTP Ticket Fest", photoUrl: null },
      });
      expect(page.body).not.toHaveProperty("participant");
      expect(page.body).not.toHaveProperty("email");

      await request(app.getHttpServer())
        .get(`/public/events/${event.slug}/tickets/unknown`)
        .expect(404);
      await request(app.getHttpServer())
        .get(`/public/events/wrong-slug/tickets/${participant.ticketToken}`)
        .expect(404);
    });
  });
});
