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
      order: number;
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

  async function storedOrder(uuid: string) {
    const template = await prisma.emailTemplate.findUnique({
      where: { uuid },
    });
    return template?.order;
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
      expect(result.triggerConfig).toEqual({});
      expect(result.order).toBeNull();

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

    it("creates a template without a schema when schema is null", async () => {
      const event = await createEvent();

      const result = await service.create(event.uuid, {
        name: "No schema",
        content: "<p>Hi</p>",
        trigger: EmailTrigger.MANUAL,
        schema: null,
      });

      expect(result.schema).toBeNull();
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

    it("returns the order of each template", async () => {
      const event = await createEvent();
      await createEmailTemplate(event.uuid, { name: "Second", order: 2 });
      await createEmailTemplate(event.uuid, { name: "Unordered" });

      const result = await service.findAll(event.uuid, new EmailListingDto());

      const orders = Object.fromEntries(
        result.data.map((t) => [t.name, t.order]),
      );
      expect(orders).toEqual({ Second: 2, Unordered: null });
    });

    it("sorts by order with unordered templates last", async () => {
      const event = await createEvent();
      await createEmailTemplate(event.uuid, { name: "Unordered" });
      await createEmailTemplate(event.uuid, { name: "Third", order: 3 });
      await createEmailTemplate(event.uuid, { name: "First", order: 1 });

      const query = Object.assign(new EmailListingDto(), { sort: "order:asc" });
      const result = await service.findAll(event.uuid, query);

      expect(result.data.map((t) => t.name)).toEqual([
        "First",
        "Third",
        "Unordered",
      ]);
    });

    it("keeps unordered templates in creation order when sorting by order", async () => {
      const event = await createEvent();
      await createEmailTemplate(event.uuid, { name: "Unordered A" });
      await createEmailTemplate(event.uuid, { name: "Unordered B" });

      const query = Object.assign(new EmailListingDto(), { sort: "order:asc" });
      const result = await service.findAll(event.uuid, query);

      expect(result.data.map((t) => t.name)).toEqual([
        "Unordered A",
        "Unordered B",
      ]);
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
    it("returns the template without delivery statuses", async () => {
      const event = await createEvent();
      const template = await createEmailTemplate(event.uuid, {
        content: "<p>Body</p>",
      });
      await createParticipantEmailStatus(template.uuid, EmailStatus.sent);

      const result = await service.findOne(event.uuid, template.uuid);

      expect(result.id).toBe(template.uuid);
      expect(result.content).toBe("<p>Body</p>");
      expect(result).not.toHaveProperty("participants");
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
      expect(result).toHaveProperty("triggerConfig");
      expect(result).toHaveProperty("order");

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

    it("clears the schema when it is set to null", async () => {
      const event = await createEvent();
      const template = await prisma.emailTemplate.create({
        data: {
          name: "With schema",
          content: "<p>Hi</p>",
          trigger: EmailTrigger.MANUAL,
          schema: { version: "1.0" },
          eventUuid: event.uuid,
        },
      });

      await service.update(event.uuid, template.uuid, { schema: null });

      const stored = await prisma.emailTemplate.findUnique({
        where: { uuid: template.uuid },
      });
      expect(stored?.schema).toBeNull();
    });

    it("keeps triggerConfig when it is omitted from the update", async () => {
      const event = await createEvent();
      const form = await createForm(event.uuid);
      const template = await createEmailTemplate(event.uuid, {
        trigger: EmailTrigger.FORM_FILLED,
        triggerConfig: { formUuid: form.uuid },
      });

      await service.update(event.uuid, template.uuid, { name: "Renamed" });
      await service.update(event.uuid, template.uuid, {
        trigger: EmailTrigger.FORM_FILLED,
      });

      const stored = await prisma.emailTemplate.findUnique({
        where: { uuid: template.uuid },
      });
      expect(stored?.triggerConfig).toEqual({ formUuid: form.uuid });
    });

    it("validates triggerConfig sent without a trigger against the stored trigger", async () => {
      const event = await createEvent();
      const form = await createForm(event.uuid);
      const template = await createEmailTemplate(event.uuid, {
        trigger: EmailTrigger.FORM_FILLED,
        triggerConfig: { formUuid: form.uuid },
      });

      await expect(
        service.update(event.uuid, template.uuid, {
          triggerConfig: { formUuid: "00000000-0000-0000-0000-000000000006" },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("clears triggerConfig when the trigger changes to one without config", async () => {
      const event = await createEvent();
      const form = await createForm(event.uuid);
      const template = await createEmailTemplate(event.uuid, {
        trigger: EmailTrigger.FORM_FILLED,
        triggerConfig: { formUuid: form.uuid },
      });

      await service.update(event.uuid, template.uuid, {
        trigger: EmailTrigger.MANUAL,
      });

      const stored = await prisma.emailTemplate.findUnique({
        where: { uuid: template.uuid },
      });
      expect(stored?.triggerConfig).toEqual({});
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
  // reorder
  // ---------------------------------------------------------------------------

  describe("reorder", () => {
    it("sets each template's order to its position in the list", async () => {
      const event = await createEvent();
      const a = await createEmailTemplate(event.uuid, { name: "A", order: 5 });
      const b = await createEmailTemplate(event.uuid, { name: "B" });
      const c = await createEmailTemplate(event.uuid, { name: "C", order: 0 });

      await service.reorder(event.uuid, [c.uuid, a.uuid, b.uuid]);

      expect(await storedOrder(c.uuid)).toBe(0);
      expect(await storedOrder(a.uuid)).toBe(1);
      expect(await storedOrder(b.uuid)).toBe(2);
    });

    it("leaves templates that are not listed untouched", async () => {
      const event = await createEvent();
      const listed = await createEmailTemplate(event.uuid, { order: 7 });
      const unlisted = await createEmailTemplate(event.uuid, { order: 9 });

      await service.reorder(event.uuid, [listed.uuid]);

      expect(await storedOrder(listed.uuid)).toBe(0);
      expect(await storedOrder(unlisted.uuid)).toBe(9);
    });

    it("throws NotFoundException and changes nothing when a template belongs to another event", async () => {
      const event = await createEvent();
      const otherEvent = await createEvent();
      const own = await createEmailTemplate(event.uuid, { order: 4 });
      const foreign = await createEmailTemplate(otherEvent.uuid, { order: 6 });

      await expect(
        service.reorder(event.uuid, [own.uuid, foreign.uuid]),
      ).rejects.toThrow(NotFoundException);

      expect(await storedOrder(own.uuid)).toBe(4);
      expect(await storedOrder(foreign.uuid)).toBe(6);
    });

    it("throws NotFoundException for an unknown template", async () => {
      const event = await createEvent();

      await expect(
        service.reorder(event.uuid, ["00000000-0000-4000-8000-000000000007"]),
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
