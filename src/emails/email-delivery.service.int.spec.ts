import { MailerService } from "@nestjs-modules/mailer";
import { PageOptionsDto } from "src/common/dto/page-options.dto";
import type {
  Attribute,
  Event,
  Form,
  Participant,
} from "src/generated/prisma/client";
import {
  AttributeType,
  EmailStatus,
  EmailTrigger,
} from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import { getQueueToken } from "@nestjs/bullmq";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";

import { EmailContentParserService } from "./email-content-parser.service";
import { EmailDeliveryService } from "./email-delivery.service";
import { EMAIL_QUEUE_NAME } from "./emails.constants";

describe("EmailDeliveryService (integration)", () => {
  let service: EmailDeliveryService;
  let prisma: PrismaService;

  // Everything hangs off an Event and cascades away with it - see
  // email-templates.service.int.spec.ts for the same reasoning.
  const createdEventUuids: string[] = [];

  const mockMailerService = {
    sendMail: jest.fn(),
  };

  const mockQueue = {
    addBulk: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) =>
      key === "SMTP_FROM" ? "test@example.com" : undefined,
    ),
    getOrThrow: jest.fn((key: string) => {
      if (key === "FRONTEND_URL") {
        return "http://localhost:3000";
      }
      if (key === "SMTP_FROM") {
        return "test@example.com";
      }
      throw new Error(`Unexpected config key requested in test: ${key}`);
    }),
  };

  // ---------------------------------------------------------------------------
  // Module setup / teardown
  // ---------------------------------------------------------------------------

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailDeliveryService,
        EmailContentParserService,
        PrismaService,
        { provide: MailerService, useValue: mockMailerService },
        { provide: getQueueToken(EMAIL_QUEUE_NAME), useValue: mockQueue },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EmailDeliveryService>(EmailDeliveryService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Only reset sendMail's implementation (mockRejectedValue etc.) - a
    // blanket jest.resetAllMocks() would also wipe mockConfigService's
    // baked-in default implementation set at file scope above.
    mockMailerService.sendMail.mockReset();
  });

  afterAll(async () => {
    await prisma.event.deleteMany({
      where: { uuid: { in: createdEventUuids } },
    });
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // Helpers / factories
  // ---------------------------------------------------------------------------

  async function createEvent(
    overrides: Partial<{
      name: string;
      slug: string;
      contactEmail: string;
    }> = {},
  ): Promise<Event> {
    const event = await prisma.event.create({
      data: {
        name: "Test Event",
        slug: `email-delivery-int-${String(Date.now())}-${Math.random().toString(36).slice(2)}`,
        startDate: new Date("2025-06-01"),
        endDate: new Date("2025-06-02"),
        ...overrides,
      },
    });
    createdEventUuids.push(event.uuid);
    return event;
  }

  async function createAttribute(
    eventUuid: string,
    overrides: Partial<{
      name: string;
      type: AttributeType;
      order: number;
    }> = {},
  ): Promise<Attribute> {
    return prisma.attribute.create({
      data: {
        eventUuid,
        type: AttributeType.text,
        name: "Test Attribute",
        order: 1,
        ...overrides,
      },
    });
  }

  async function createForm(
    eventUuid: string,
    overrides: Partial<{ name: string }> = {},
  ): Promise<Form> {
    return prisma.form.create({
      data: {
        name: "Test Form",
        eventUuid,
        ...overrides,
      },
    });
  }

  async function createParticipant(
    eventUuid: string,
    overrides: Partial<{ email: string }> = {},
  ): Promise<Participant> {
    return prisma.participant.create({
      data: {
        email: `${String(Date.now())}-${Math.random().toString(36).slice(2)}@delivery-int.local`,
        eventUuid,
        ...overrides,
      },
    });
  }

  async function createEmailTemplate(
    eventUuid: string,
    overrides: Partial<{
      name: string;
      content: string;
      trigger: EmailTrigger;
    }> = {},
  ) {
    return prisma.emailTemplate.create({
      data: {
        name: "Test Email",
        content: "<p>Hello</p>",
        trigger: EmailTrigger.MANUAL,
        eventUuid,
        ...overrides,
      },
    });
  }

  async function createPendingStatus(
    emailUuid: string,
    participantUuid?: string,
  ): Promise<string> {
    const status = await prisma.participantEmailStatus.create({
      data: {
        emailUuid,
        participantUuid,
        status: EmailStatus.pending,
        sendAt: new Date(),
      },
    });
    return status.uuid;
  }

  // ---------------------------------------------------------------------------
  // sendEmailToParticipants
  // ---------------------------------------------------------------------------

  describe("sendEmailToParticipants", () => {
    it("creates a pending status row per participant and enqueues one job each", async () => {
      const event = await createEvent();
      const template = await createEmailTemplate(event.uuid);
      const participantA = await createParticipant(event.uuid);
      const participantB = await createParticipant(event.uuid);

      await service.sendEmailToParticipants(template.uuid, [
        participantA.uuid,
        participantB.uuid,
      ]);

      const statuses = await prisma.participantEmailStatus.findMany({
        where: { emailUuid: template.uuid },
      });
      expect(statuses).toHaveLength(2);
      for (const status of statuses) {
        expect(status.status).toBe(EmailStatus.pending);
        expect([participantA.uuid, participantB.uuid]).toContain(
          status.participantUuid,
        );
      }

      expect(mockQueue.addBulk).toHaveBeenCalledTimes(1);
      const [jobs] = mockQueue.addBulk.mock.calls[0] as [
        { data: { participantUuid: string; statusUuid: string } }[],
      ];
      expect(jobs).toHaveLength(2);
      const jobStatusUuids = jobs.map((job) => job.data.statusUuid).toSorted();
      const databaseStatusUuids = statuses
        .map((status) => status.uuid)
        .toSorted();
      expect(jobStatusUuids).toEqual(databaseStatusUuids);
    });

    it("records the status unlinked when a participant snapshot is provided", async () => {
      const event = await createEvent();
      const template = await createEmailTemplate(event.uuid);
      const participant = await createParticipant(event.uuid);
      const snapshot = {
        uuid: participant.uuid,
        email: participant.email,
        createdAt: participant.createdAt,
        updatedAt: participant.updatedAt,
        attributes: [],
      };

      await service.sendEmailToParticipants(
        template.uuid,
        [participant.uuid],
        snapshot,
      );

      const statuses = await prisma.participantEmailStatus.findMany({
        where: { emailUuid: template.uuid },
      });
      expect(statuses).toHaveLength(1);
      expect(statuses[0].participantUuid).toBeNull();
    });

    it("does nothing when the participant list is empty", async () => {
      const event = await createEvent();
      const template = await createEmailTemplate(event.uuid);

      await service.sendEmailToParticipants(template.uuid, []);

      const statuses = await prisma.participantEmailStatus.findMany({
        where: { emailUuid: template.uuid },
      });
      expect(statuses).toHaveLength(0);
      expect(mockQueue.addBulk).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // deliverEmailToParticipants
  // ---------------------------------------------------------------------------

  describe("deliverEmailToParticipants", () => {
    it("parses real event/participant/attribute/form data, sends the mail, and marks the status sent", async () => {
      const event = await createEvent({
        name: "Summer Fest",
        contactEmail: "organizer@example.com",
      });
      const attribute = await createAttribute(event.uuid, {
        name: "T-shirt size",
      });
      const form = await createForm(event.uuid, { name: "Feedback form" });
      const participant = await createParticipant(event.uuid, {
        email: "attendee@example.com",
      });
      await prisma.participantAttribute.create({
        data: {
          participantUuid: participant.uuid,
          attributeUuid: attribute.uuid,
          value: "XL",
        },
      });
      const template = await createEmailTemplate(event.uuid, {
        content: `<p>Event: <span data-id="/event_name"></span></p>
<p>Email: <span data-id="/participant_email"></span></p>
<p>Size: <span data-id="/participant_${attribute.uuid}"></span></p>
<p><span data-id="/form_${form.uuid}"></span></p>`,
      });

      const statusUuid = await createPendingStatus(
        template.uuid,
        participant.uuid,
      );

      await service.deliverEmailToParticipants(
        template.uuid,
        participant.uuid,
        statusUuid,
      );

      expect(mockMailerService.sendMail).toHaveBeenCalledTimes(1);
      const [sendMailArguments] = mockMailerService.sendMail.mock.calls[0] as [
        { to: string; html: string; replyTo: string },
      ];
      expect(sendMailArguments.to).toBe("attendee@example.com");
      expect(sendMailArguments.html).toContain("Summer Fest");
      expect(sendMailArguments.html).toContain("attendee@example.com");
      expect(sendMailArguments.html).toContain("XL");
      expect(sendMailArguments.html).toContain(
        `http://localhost:3000/${event.slug}/${form.uuid}/${participant.uuid}`,
      );
      expect(sendMailArguments.replyTo).toBe("organizer@example.com");

      const status = await prisma.participantEmailStatus.findUnique({
        where: { uuid: statusUuid },
      });
      expect(status?.status).toBe(EmailStatus.sent);
    });

    it("marks the status failed and rethrows when sending fails, so BullMQ retries", async () => {
      const event = await createEvent();
      const participant = await createParticipant(event.uuid);
      const template = await createEmailTemplate(event.uuid);
      const statusUuid = await createPendingStatus(
        template.uuid,
        participant.uuid,
      );

      mockMailerService.sendMail.mockRejectedValue(new Error("SMTP down"));

      await expect(
        service.deliverEmailToParticipants(
          template.uuid,
          participant.uuid,
          statusUuid,
        ),
      ).rejects.toThrow("SMTP down");

      const status = await prisma.participantEmailStatus.findUnique({
        where: { uuid: statusUuid },
      });
      expect(status?.status).toBe(EmailStatus.failed);
    });

    it("marks the status failed and throws NotFoundException when the participant no longer exists", async () => {
      const event = await createEvent();
      const template = await createEmailTemplate(event.uuid);
      const statusUuid = await createPendingStatus(template.uuid);
      const fakeParticipantUuid = "00000000-0000-0000-0000-000000000006";

      await expect(
        service.deliverEmailToParticipants(
          template.uuid,
          fakeParticipantUuid,
          statusUuid,
        ),
      ).rejects.toThrow(NotFoundException);

      const status = await prisma.participantEmailStatus.findUnique({
        where: { uuid: statusUuid },
      });
      expect(status?.status).toBe(EmailStatus.failed);
      expect(mockMailerService.sendMail).not.toHaveBeenCalled();
    });

    it("uses the provided snapshot instead of querying the (now deleted) participant row", async () => {
      const event = await createEvent();
      const participant = await createParticipant(event.uuid, {
        email: "deleted@example.com",
      });
      const template = await createEmailTemplate(event.uuid);
      const snapshot = {
        uuid: participant.uuid,
        email: participant.email,
        createdAt: participant.createdAt,
        updatedAt: participant.updatedAt,
        attributes: [],
      };
      const statusUuid = await createPendingStatus(template.uuid);

      // Simulate the participant already being gone by the time the job runs.
      await prisma.participant.delete({ where: { uuid: participant.uuid } });

      await service.deliverEmailToParticipants(
        template.uuid,
        participant.uuid,
        statusUuid,
        snapshot,
      );

      const [sendMailArguments] = mockMailerService.sendMail.mock.calls[0] as [
        { to: string },
      ];
      expect(sendMailArguments.to).toBe("deleted@example.com");
    });
  });

  // ---------------------------------------------------------------------------
  // sendManualEmail
  // ---------------------------------------------------------------------------

  describe("sendManualEmail", () => {
    it("enqueues the email for participants that belong to the event", async () => {
      const event = await createEvent();
      const template = await createEmailTemplate(event.uuid);
      const participant = await createParticipant(event.uuid);

      await service.sendManualEmail(event.uuid, template.uuid, [
        participant.uuid,
      ]);

      const statuses = await prisma.participantEmailStatus.findMany({
        where: { emailUuid: template.uuid },
      });
      expect(statuses).toHaveLength(1);
      expect(mockQueue.addBulk).toHaveBeenCalledTimes(1);
    });

    it("throws BadRequestException when a participant does not belong to the event", async () => {
      const event = await createEvent();
      const otherEvent = await createEvent();
      const template = await createEmailTemplate(event.uuid);
      const outsider = await createParticipant(otherEvent.uuid);

      await expect(
        service.sendManualEmail(event.uuid, template.uuid, [outsider.uuid]),
      ).rejects.toThrow(BadRequestException);

      expect(mockQueue.addBulk).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the email template does not exist in this event", async () => {
      const event = await createEvent();
      const otherEvent = await createEvent();
      const templateInOtherEvent = await createEmailTemplate(otherEvent.uuid);
      const participant = await createParticipant(event.uuid);

      await expect(
        service.sendManualEmail(event.uuid, templateInOtherEvent.uuid, [
          participant.uuid,
        ]),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // sendTestEmail
  // ---------------------------------------------------------------------------

  describe("sendTestEmail", () => {
    it("sends synchronously using a real participant's data, bypassing the queue", async () => {
      const event = await createEvent({ name: "Winter Gala" });
      const participant = await createParticipant(event.uuid, {
        email: "real-participant@example.com",
      });
      const template = await createEmailTemplate(event.uuid, {
        content: `<p><span data-id="/event_name"></span> for <span data-id="/participant_email"></span></p>`,
      });

      await service.sendTestEmail(
        event.uuid,
        template.uuid,
        "tester@example.com",
        participant.uuid,
      );

      expect(mockQueue.addBulk).not.toHaveBeenCalled();
      const [sendMailArguments] = mockMailerService.sendMail.mock.calls[0] as [
        { to: string; html: string },
      ];
      expect(sendMailArguments.to).toBe("tester@example.com");
      expect(sendMailArguments.html).toContain("Winter Gala");
      expect(sendMailArguments.html).toContain("real-participant@example.com");
    });

    it("sends using a placeholder participant when no participantUuid is given", async () => {
      const event = await createEvent({ name: "No Participant Event" });
      const template = await createEmailTemplate(event.uuid, {
        content: `<p><span data-id="/event_name"></span></p>`,
      });

      await service.sendTestEmail(
        event.uuid,
        template.uuid,
        "tester@example.com",
      );

      const [sendMailArguments] = mockMailerService.sendMail.mock.calls[0] as [
        { to: string; html: string },
      ];
      expect(sendMailArguments.to).toBe("tester@example.com");
      expect(sendMailArguments.html).toContain("No Participant Event");
    });

    it("throws BadRequestException when the given participant does not belong to the event", async () => {
      const event = await createEvent();
      const otherEvent = await createEvent();
      const template = await createEmailTemplate(event.uuid);
      const outsider = await createParticipant(otherEvent.uuid);

      await expect(
        service.sendTestEmail(
          event.uuid,
          template.uuid,
          "tester@example.com",
          outsider.uuid,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // findParticipantsForEmail
  // ---------------------------------------------------------------------------

  describe("findParticipantsForEmail", () => {
    it("returns flattened status/sendAt/sendBy joined with participant data", async () => {
      const event = await createEvent();
      const template = await createEmailTemplate(event.uuid);
      const participant = await createParticipant(event.uuid, {
        email: "joined@example.com",
      });
      await prisma.participantEmailStatus.create({
        data: {
          emailUuid: template.uuid,
          participantUuid: participant.uuid,
          status: EmailStatus.sent,
          sendAt: new Date("2025-02-22T19:13:10.471Z"),
          sendBy: "Jan Kowalski",
        },
      });

      const result = await service.findParticipantsForEmail(
        event.uuid,
        template.uuid,
        new PageOptionsDto(),
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: participant.uuid,
        email: "joined@example.com",
        status: EmailStatus.sent,
        sendBy: "Jan Kowalski",
      });
    });

    it("throws NotFoundException when the email does not belong to this event", async () => {
      const event = await createEvent();
      const otherEvent = await createEvent();
      const templateInOtherEvent = await createEmailTemplate(otherEvent.uuid);

      await expect(
        service.findParticipantsForEmail(
          event.uuid,
          templateInOtherEvent.uuid,
          new PageOptionsDto(),
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
