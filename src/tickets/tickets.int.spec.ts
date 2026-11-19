import { EmailContentParserService } from "src/emails/email-content-parser.service";
import type { EmailTemplateForParsing } from "src/emails/email-content-parser.service";
import { PrismaService } from "src/prisma/prisma.service";
import { StorageService } from "src/storage/storage.service";

import { ConflictException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import type { TicketParticipantsListingDto } from "./dto/ticket-participants-listing.dto";
import { TicketScanStatus } from "./entities/ticket-scan-result.entity";
import { TicketParticipantsService } from "./ticket-participants.service";
import { TicketPublicService } from "./ticket-public.service";
import { TicketScanService } from "./ticket-scan.service";
import { TicketsService } from "./tickets.service";

const unique = () =>
  `${String(Date.now())}-${Math.random().toString(36).slice(2)}`;

const listing = (
  overrides: Partial<TicketParticipantsListingDto> = {},
): TicketParticipantsListingDto =>
  ({ page: 1, take: 50, skip: 0, ...overrides }) as never;

const template = (slug: string) =>
  ({
    content: '<p><span data-id="/ticket_link"></span></p>',
    event: { slug, attributes: [], forms: [] },
  }) as unknown as EmailTemplateForParsing;

const parsingParticipant = (ticketToken?: string) => ({
  uuid: "p",
  email: "a@example.com",
  ticketToken,
  createdAt: new Date(),
  updatedAt: new Date(),
  attributes: [],
});

describe("Tickets (integration)", () => {
  let prisma: PrismaService;
  let tickets: TicketsService;
  let scan: TicketScanService;
  let participantsList: TicketParticipantsService;
  let publicService: TicketPublicService;
  let parser: EmailContentParserService;

  const createdEventUuids: string[] = [];
  const createdAdminUuids: string[] = [];

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === "FRONTEND_URL") {
        return "http://localhost:3000";
      }
      if (key === "S3_BUCKET_EVENTS") {
        return "events";
      }
      throw new Error(`Unexpected config key requested in test: ${key}`);
    }),
  };

  const mockStorageService = {
    getUrl: jest.fn(
      (bucket: string, key: string) => `https://s3/${bucket}/${key}`,
    ),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        TicketScanService,
        TicketParticipantsService,
        TicketPublicService,
        EmailContentParserService,
        PrismaService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    prisma = module.get(PrismaService);
    tickets = module.get(TicketsService);
    scan = module.get(TicketScanService);
    participantsList = module.get(TicketParticipantsService);
    publicService = module.get(TicketPublicService);
    parser = module.get(EmailContentParserService);
  });

  afterAll(async () => {
    await prisma.event.deleteMany({
      where: { uuid: { in: createdEventUuids } },
    });
    await prisma.admin.deleteMany({
      where: { uuid: { in: createdAdminUuids } },
    });
    await prisma.$disconnect();
  });

  async function createEvent(photoKey?: string) {
    const event = await prisma.event.create({
      data: {
        name: "Ticket Fest",
        slug: `tickets-int-${unique()}`,
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-06-02"),
        location: "Wroclaw",
        photoKey,
      },
    });
    createdEventUuids.push(event.uuid);
    return event;
  }

  async function createAdmin() {
    const admin = await prisma.admin.create({
      data: {
        firstName: "Door",
        lastName: "Staff",
        password: "x",
        email: `tickets-int-${unique()}@example.com`,
      },
    });
    createdAdminUuids.push(admin.uuid);
    return admin;
  }

  async function createWorkshopSetup() {
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
    const root = await prisma.block.create({
      data: {
        name: "root",
        attributeUuid: blockAttribute.uuid,
        isRootBlock: true,
      },
    });
    const workshopA = await prisma.block.create({
      data: {
        name: "A",
        attributeUuid: blockAttribute.uuid,
        parentUuid: root.uuid,
      },
    });
    const workshopB = await prisma.block.create({
      data: {
        name: "B",
        attributeUuid: blockAttribute.uuid,
        parentUuid: root.uuid,
      },
    });
    const addParticipant = async (email: string, blocks: string[] | string) =>
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
      workshopA,
      workshopB,
      addParticipant,
    };
  }

  describe("schema", () => {
    it("gives every participant a distinct 64 character ticket token", async () => {
      const event = await createEvent();
      const [first, second] = await Promise.all([
        prisma.participant.create({
          data: { email: `a-${unique()}@example.com`, eventUuid: event.uuid },
        }),
        prisma.participant.create({
          data: { email: `b-${unique()}@example.com`, eventUuid: event.uuid },
        }),
      ]);

      expect(first.ticketToken).toHaveLength(64);
      expect(second.ticketToken).toHaveLength(64);
      expect(first.ticketToken).not.toBe(second.ticketToken);
    });

    it("rejects an EVENT ticket with an attribute and a BLOCK ticket without one", async () => {
      const { event, blockAttribute } = await createWorkshopSetup();

      await expect(
        prisma.ticket.create({
          data: {
            eventUuid: event.uuid,
            mode: "EVENT",
            attributeUuid: blockAttribute.uuid,
          },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.ticket.create({
          data: { eventUuid: event.uuid, mode: "BLOCK" },
        }),
      ).rejects.toThrow();
    });

    it("allows only one EVENT ticket per event and one ticket per attribute", async () => {
      const { event, blockAttribute } = await createWorkshopSetup();

      await tickets.create(event.uuid, { mode: "EVENT" });
      await expect(
        tickets.create(event.uuid, { mode: "EVENT" }),
      ).rejects.toThrow(ConflictException);

      await tickets.create(event.uuid, {
        mode: "BLOCK",
        attributeUuid: blockAttribute.uuid,
      });
      await expect(
        tickets.create(event.uuid, {
          mode: "BLOCK",
          attributeUuid: blockAttribute.uuid,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("cascades check-ins when the block is deleted and keeps them when the admin is deleted", async () => {
      const { event, blockAttribute, workshopA, addParticipant } =
        await createWorkshopSetup();
      const admin = await createAdmin();
      const participant = await addParticipant("cascade@example.com", [
        workshopA.uuid,
      ]);
      const ticket = await tickets.create(event.uuid, {
        mode: "BLOCK",
        attributeUuid: blockAttribute.uuid,
      });
      await scan.confirm(
        event.uuid,
        ticket.uuid,
        { token: participant.ticketToken, blockUuid: workshopA.uuid },
        admin.uuid,
      );

      await prisma.admin.delete({ where: { uuid: admin.uuid } });
      const afterAdminDelete = await prisma.ticketCheckIn.findFirst({
        where: { ticketUuid: ticket.uuid },
      });
      expect(afterAdminDelete).not.toBeNull();
      expect(afterAdminDelete?.confirmedByAdminUuid).toBeNull();

      await prisma.block.delete({ where: { uuid: workshopA.uuid } });
      expect(
        await prisma.ticketCheckIn.count({
          where: { ticketUuid: ticket.uuid },
        }),
      ).toBe(0);
    });
  });

  describe("scan and confirm", () => {
    it("lets exactly one of several concurrent confirms win", async () => {
      const event = await createEvent();
      const admin = await createAdmin();
      const participant = await prisma.participant.create({
        data: { email: `race-${unique()}@example.com`, eventUuid: event.uuid },
      });
      const ticket = await tickets.create(event.uuid, { mode: "EVENT" });
      const dto = { token: participant.ticketToken };

      const before = await scan.scan(event.uuid, ticket.uuid, dto);
      expect(before.status).toBe(TicketScanStatus.VALID);

      const results = await Promise.allSettled([
        scan.confirm(event.uuid, ticket.uuid, dto, admin.uuid),
        scan.confirm(event.uuid, ticket.uuid, dto, admin.uuid),
        scan.confirm(event.uuid, ticket.uuid, dto, admin.uuid),
      ]);

      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      for (const result of results) {
        if (result.status === "rejected") {
          expect(result.reason).toBeInstanceOf(ConflictException);
        }
      }
      expect(
        await prisma.ticketCheckIn.count({
          where: { ticketUuid: ticket.uuid },
        }),
      ).toBe(1);
      const after = await scan.scan(event.uuid, ticket.uuid, dto);
      expect(after.status).toBe(TicketScanStatus.ALREADY_CONFIRMED);
    });

    it("tracks attendance per block", async () => {
      const { event, blockAttribute, workshopA, workshopB, addParticipant } =
        await createWorkshopSetup();
      const admin = await createAdmin();
      const participant = await addParticipant("both@example.com", [
        workshopA.uuid,
        workshopB.uuid,
      ]);
      const ticket = await tickets.create(event.uuid, {
        mode: "BLOCK",
        attributeUuid: blockAttribute.uuid,
      });
      const token = participant.ticketToken;

      await scan.confirm(
        event.uuid,
        ticket.uuid,
        { token, blockUuid: workshopA.uuid },
        admin.uuid,
      );

      const atA = await scan.scan(event.uuid, ticket.uuid, {
        token,
        blockUuid: workshopA.uuid,
      });
      const atB = await scan.scan(event.uuid, ticket.uuid, {
        token,
        blockUuid: workshopB.uuid,
      });
      expect(atA.status).toBe(TicketScanStatus.ALREADY_CONFIRMED);
      expect(atB.status).toBe(TicketScanStatus.VALID);
    });

    it("returns WRONG_EVENT and INVALID_TICKET without leaking anything", async () => {
      const event = await createEvent();
      const otherEvent = await createEvent();
      const outsider = await prisma.participant.create({
        data: {
          email: `out-${unique()}@example.com`,
          eventUuid: otherEvent.uuid,
        },
      });
      const ticket = await tickets.create(event.uuid, { mode: "EVENT" });

      expect(
        await scan.scan(event.uuid, ticket.uuid, {
          token: outsider.ticketToken,
        }),
      ).toEqual({ status: TicketScanStatus.WRONG_EVENT });
      expect(
        await scan.scan(event.uuid, ticket.uuid, { token: "nope" }),
      ).toEqual({ status: TicketScanStatus.INVALID_TICKET });
    });

    it("returns WRONG_BLOCK with the names of the blocks the participant is in", async () => {
      const { event, blockAttribute, workshopA, workshopB, addParticipant } =
        await createWorkshopSetup();
      const participant = await addParticipant("wrong@example.com", [
        workshopB.uuid,
      ]);
      const ticket = await tickets.create(event.uuid, {
        mode: "BLOCK",
        attributeUuid: blockAttribute.uuid,
      });

      expect(
        await scan.scan(event.uuid, ticket.uuid, {
          token: participant.ticketToken,
          blockUuid: workshopA.uuid,
        }),
      ).toEqual({ status: TicketScanStatus.WRONG_BLOCK, blockNames: ["B"] });
    });
  });

  describe("participants list", () => {
    it("filters by block, attendance and email", async () => {
      const {
        event,
        blockAttribute,
        textAttribute,
        workshopA,
        workshopB,
        addParticipant,
      } = await createWorkshopSetup();
      const admin = await createAdmin();
      const one = await addParticipant("one@example.com", [
        workshopA.uuid,
        workshopB.uuid,
      ]);
      await addParticipant("two@example.com", [workshopB.uuid]);
      await addParticipant("three@example.com", workshopA.uuid);
      const ticket = await tickets.create(event.uuid, {
        mode: "BLOCK",
        attributeUuid: blockAttribute.uuid,
        shownAttributeUuids: [textAttribute.uuid, blockAttribute.uuid],
      });
      await scan.confirm(
        event.uuid,
        ticket.uuid,
        { token: one.ticketToken, blockUuid: workshopA.uuid },
        admin.uuid,
      );

      const emails = async (
        overrides: Partial<TicketParticipantsListingDto>,
      ) => {
        const page = await participantsList.findAll(
          event.uuid,
          ticket.uuid,
          listing(overrides),
        );
        return page.data.map(
          (row) => `${row.email}:${String(row.attendance.confirmed)}`,
        );
      };

      expect(await emails({ blockUuid: workshopA.uuid })).toEqual([
        "one@example.com:true",
        "three@example.com:false",
      ]);
      expect(
        await emails({ blockUuid: workshopA.uuid, confirmed: true }),
      ).toEqual(["one@example.com:true"]);
      expect(
        await emails({ blockUuid: workshopA.uuid, confirmed: false }),
      ).toEqual(["three@example.com:false"]);
      expect(await emails({ blockUuid: workshopB.uuid })).toEqual([
        "one@example.com:false",
        "two@example.com:false",
      ]);
      expect(
        await emails({ blockUuid: workshopA.uuid, search: "THR" }),
      ).toEqual(["three@example.com:false"]);

      const page = await participantsList.findAll(
        event.uuid,
        ticket.uuid,
        listing({ blockUuid: workshopA.uuid }),
      );
      expect(
        page.data[0].attributes.find(
          (a) => a.attributeUuid === blockAttribute.uuid,
        )?.blockNames,
      ).toEqual(["A", "B"]);
    });
  });

  describe("public ticket page", () => {
    it("returns the token and event display fields", async () => {
      const event = await createEvent("photo.png");
      const participant = await prisma.participant.create({
        data: { email: `pub-${unique()}@example.com`, eventUuid: event.uuid },
      });
      await tickets.create(event.uuid, { mode: "EVENT" });

      const result = await publicService.findByToken(
        event.slug,
        participant.ticketToken,
      );

      expect(result).toEqual({
        token: participant.ticketToken,
        event: {
          name: "Ticket Fest",
          startDate: event.startDate,
          endDate: event.endDate,
          location: "Wroclaw",
          primaryColor: null,
          photoUrl: "https://s3/events/photo.png",
        },
      });
    });

    it("returns the same 404 for an unknown token, a wrong slug and an event without tickets", async () => {
      const event = await createEvent();
      const otherEvent = await createEvent();
      const participant = await prisma.participant.create({
        data: { email: `pub-${unique()}@example.com`, eventUuid: event.uuid },
      });

      const failures = await Promise.all([
        publicService
          .findByToken(event.slug, "unknown-token")
          .catch((error: unknown) => error),
        publicService
          .findByToken(otherEvent.slug, participant.ticketToken)
          .catch((error: unknown) => error),
        publicService
          .findByToken(event.slug, participant.ticketToken)
          .catch((error: unknown) => error),
      ]);

      for (const failure of failures) {
        expect(failure).toBeInstanceOf(NotFoundException);
      }
      const messages = new Set(
        failures.map((failure) => (failure as NotFoundException).message),
      );
      expect(messages.size).toBe(1);
    });
  });

  describe("/ticket_link email tag", () => {
    it("renders a link to the ticket page", () => {
      const { html } = parser.parseEmailContent(
        template("my-event"),
        parsingParticipant("tok123"),
      );

      expect(html).toBe(
        '<p><a href="http://localhost:3000/my-event/ticket/tok123">http://localhost:3000/my-event/ticket/tok123</a></p>',
      );
    });

    it("renders nothing when the participant has no token", () => {
      const { html } = parser.parseEmailContent(
        template("my-event"),
        parsingParticipant(),
      );

      expect(html).toBe("<p></p>");
    });
  });
});
