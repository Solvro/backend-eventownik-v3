import type { Event, Form } from "src/generated/prisma/client";
import { EmailStatus, EmailTrigger } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";

import { EmailListingDto } from "./dto/email-listing.dto";
import { EmailTemplatesService } from "./email-templates.service";

describe("EmailTemplatesService (integration)", () => {
  let service: EmailTemplatesService;
  let prisma: PrismaService;

  // Everything created in this suite hangs off an Event, and every child
  // table (Attributes, Forms, EmailTemplates, Participants,
  // ParticipantsEmailStatuses, ...) cascades on Event deletion - so tracking
  // event UUIDs is enough to clean up completely.
  const createdEventUuids: string[] = [];

  // ---------------------------------------------------------------------------
  // Module setup / teardown
  // ---------------------------------------------------------------------------

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailTemplatesService, PrismaService],
    }).compile();

    service = module.get<EmailTemplatesService>(EmailTemplatesService);
    prisma = module.get<PrismaService>(PrismaService);
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
    overrides: Partial<{ name: string; slug: string }> = {},
  ): Promise<Event> {
    const event = await prisma.event.create({
      data: {
        name: "Test Event",
        slug: `email-templates-int-${String(Date.now())}-${Math.random().toString(36).slice(2)}`,
        startDate: new Date("2025-06-01"),
        endDate: new Date("2025-06-02"),
        ...overrides,
      },
    });
    createdEventUuids.push(event.uuid);
    return event;
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

  async function createEmailTemplate(
    eventUuid: string,
    overrides: Partial<{
      name: string;
      content: string;
      trigger: EmailTrigger;
      triggerConfig: object;
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

  async function createParticipantEmailStatus(
    emailUuid: string,
    status: EmailStatus,
  ) {
    return prisma.participantEmailStatus.create({
      data: {
        emailUuid,
        status,
        sendAt: new Date(),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe("create", () => {
    it("creates an email template for an existing event", async () => {
      const event = await createEvent();

      const result = await service.create(event.uuid, {
        name: "Welcome email",
        content: "<p>Welcome</p>",
        trigger: EmailTrigger.MANUAL,
      });

      expect(result.id).toBeDefined();
      expect(result.name).toBe("Welcome email");
      expect(result.eventId).toBe(event.uuid);

      const stored = await prisma.emailTemplate.findUnique({
        where: { uuid: result.id },
      });
      expect(stored?.content).toBe("<p>Welcome</p>");
    });

    it("throws BadRequestException when the event does not exist", async () => {
      const fakeEventUuid = "00000000-0000-0000-0000-000000000001";

      await expect(
        service.create(fakeEventUuid, {
          name: "Welcome email",
          content: "<p>Welcome</p>",
          trigger: EmailTrigger.MANUAL,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException for FORM_FILLED trigger when triggerConfig.formUuid does not belong to the event", async () => {
      const event = await createEvent();
      const otherEvent = await createEvent();
      const formInOtherEvent = await createForm(otherEvent.uuid);

      await expect(
        service.create(event.uuid, {
          name: "Form filled email",
          content: "<p>Thanks</p>",
          trigger: EmailTrigger.FORM_FILLED,
          triggerConfig: { formUuid: formInOtherEvent.uuid },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("creates successfully for FORM_FILLED trigger when triggerConfig.formUuid belongs to the event", async () => {
      const event = await createEvent();
      const form = await createForm(event.uuid);

      const result = await service.create(event.uuid, {
        name: "Form filled email",
        content: "<p>Thanks</p>",
        trigger: EmailTrigger.FORM_FILLED,
        triggerConfig: { formUuid: form.uuid },
      });

      expect(result.id).toBeDefined();
    });

    it("throws BadRequestException for ATTRIBUTE_CHANGED trigger without a triggerConfig", async () => {
      const event = await createEvent();

      await expect(
        service.create(event.uuid, {
          name: "Attribute changed email",
          content: "<p>Changed</p>",
          trigger: EmailTrigger.ATTRIBUTE_CHANGED,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------

  describe("findAll", () => {
    it("returns templates for the event with zeroed counts when no statuses exist", async () => {
      const event = await createEvent();
      await createEmailTemplate(event.uuid, { name: "No statuses yet" });

      const result = await service.findAll(event.uuid, new EmailListingDto());

      const template = result.data.find((t) => t.name === "No statuses yet");
      expect(template).toBeDefined();
      if (template == null) {
        return;
      }
      expect(template.meta).toEqual({
        failedCount: 0,
        pendingCount: 0,
        sentCount: 0,
      });
    });

    it("aggregates sent/failed/pending counts from real status rows", async () => {
      const event = await createEvent();
      const template = await createEmailTemplate(event.uuid, {
        name: "With statuses",
      });
      await createParticipantEmailStatus(template.uuid, EmailStatus.sent);
      await createParticipantEmailStatus(template.uuid, EmailStatus.sent);
      await createParticipantEmailStatus(template.uuid, EmailStatus.failed);
      await createParticipantEmailStatus(template.uuid, EmailStatus.pending);

      const result = await service.findAll(event.uuid, new EmailListingDto());

      const found = result.data.find((t) => t.id === template.uuid);
      expect(found).toBeDefined();
      if (found == null) {
        return;
      }
      expect(found.meta).toEqual({
        sentCount: 2,
        failedCount: 1,
        pendingCount: 1,
      });
    });

    it("filters templates by trigger", async () => {
      const event = await createEvent();
      await createEmailTemplate(event.uuid, {
        name: "Manual one",
        trigger: EmailTrigger.MANUAL,
      });
      await createEmailTemplate(event.uuid, {
        name: "Registered one",
        trigger: EmailTrigger.PARTICIPANT_REGISTERED,
      });

      const query = Object.assign(new EmailListingDto(), {
        trigger: EmailTrigger.PARTICIPANT_REGISTERED,
      });
      const result = await service.findAll(event.uuid, query);

      const names = result.data.map((t) => t.name);
      expect(names).toContain("Registered one");
      expect(names).not.toContain("Manual one");
    });

    it("throws BadRequestException when the event does not exist", async () => {
      const fakeEventUuid = "00000000-0000-0000-0000-000000000002";

      await expect(
        service.findAll(fakeEventUuid, new EmailListingDto()),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------

  describe("findOne", () => {
    it("returns the template with an empty participants array", async () => {
      const event = await createEvent();
      const template = await createEmailTemplate(event.uuid, {
        content: "<p>Body</p>",
      });

      const result = await service.findOne(event.uuid, template.uuid);

      expect(result.id).toBe(template.uuid);
      expect(result.content).toBe("<p>Body</p>");
      expect(result.participants).toEqual([]);
    });

    it("throws NotFoundException when the template belongs to a different event", async () => {
      const event = await createEvent();
      const otherEvent = await createEvent();
      const template = await createEmailTemplate(event.uuid);

      await expect(
        service.findOne(otherEvent.uuid, template.uuid),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException when the template does not exist", async () => {
      const event = await createEvent();
      const fakeEmailUuid = "00000000-0000-0000-0000-000000000003";

      await expect(service.findOne(event.uuid, fakeEmailUuid)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe("update", () => {
    it("updates the template fields", async () => {
      const event = await createEvent();
      const template = await createEmailTemplate(event.uuid);

      const result = await service.update(event.uuid, template.uuid, {
        name: "Renamed",
        content: "<p>Updated</p>",
      });

      expect(result.name).toBe("Renamed");
      expect(result.content).toBe("<p>Updated</p>");

      const stored = await prisma.emailTemplate.findUnique({
        where: { uuid: template.uuid },
      });
      expect(stored?.name).toBe("Renamed");
    });

    it("re-validates triggerConfig when the trigger is changed", async () => {
      const event = await createEvent();
      const template = await createEmailTemplate(event.uuid, {
        trigger: EmailTrigger.MANUAL,
      });

      await expect(
        service.update(event.uuid, template.uuid, {
          trigger: EmailTrigger.FORM_FILLED,
          triggerConfig: { formUuid: "00000000-0000-0000-0000-000000000004" },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws NotFoundException when the template does not exist in this event", async () => {
      const event = await createEvent();
      const otherEvent = await createEvent();
      const template = await createEmailTemplate(otherEvent.uuid);

      await expect(
        service.update(event.uuid, template.uuid, { name: "Nope" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------

  describe("remove", () => {
    it("deletes the template", async () => {
      const event = await createEvent();
      const template = await createEmailTemplate(event.uuid);

      await service.remove(event.uuid, template.uuid);

      const stored = await prisma.emailTemplate.findUnique({
        where: { uuid: template.uuid },
      });
      expect(stored).toBeNull();
    });

    it("throws NotFoundException when the template does not exist in this event", async () => {
      const event = await createEvent();
      const fakeEmailUuid = "00000000-0000-0000-0000-000000000005";

      await expect(service.remove(event.uuid, fakeEmailUuid)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
