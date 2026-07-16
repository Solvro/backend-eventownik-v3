import { AttributeChangedEvent } from "src/common/events/attribute-changed.event";
import { FormFilledEvent } from "src/common/events/form-filled.event";
import { ParticipantDeletedEvent } from "src/common/events/participant-deleted.event";
import { ParticipantRegisteredEvent } from "src/common/events/participant-registered.event";
import type { Event } from "src/generated/prisma/client";
import { EmailTrigger } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";

import { EmailDeliveryService } from "./email-delivery.service";
import { EmailsListeners } from "./emails.listeners";

describe("EmailsListeners (integration)", () => {
  let listeners: EmailsListeners;
  let prisma: PrismaService;

  // Everything hangs off an Event and cascades away with it - see
  // email-templates.service.int.spec.ts for the same reasoning.
  const createdEventUuids: string[] = [];

  const mockEmailDeliveryService = {
    sendEmailToParticipants: jest.fn(),
  };

  // ---------------------------------------------------------------------------
  // Module setup / teardown
  // ---------------------------------------------------------------------------

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailsListeners,
        PrismaService,
        {
          provide: EmailDeliveryService,
          useValue: mockEmailDeliveryService,
        },
      ],
    }).compile();

    listeners = module.get<EmailsListeners>(EmailsListeners);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
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

  async function createEvent(): Promise<Event> {
    const event = await prisma.event.create({
      data: {
        name: "Test Event",
        slug: `emails-listeners-int-${String(Date.now())}-${Math.random().toString(36).slice(2)}`,
        startDate: new Date("2025-06-01"),
        endDate: new Date("2025-06-02"),
      },
    });
    createdEventUuids.push(event.uuid);
    return event;
  }

  async function createEmailTemplate(
    eventUuid: string,
    trigger: EmailTrigger,
    triggerConfig?: object,
  ) {
    return prisma.emailTemplate.create({
      data: {
        name: "Test Email",
        content: "<p>Hello</p>",
        trigger,
        triggerConfig,
        eventUuid,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // participant.registered
  // ---------------------------------------------------------------------------

  describe("handleParticipantRegisteredEvent", () => {
    it("sends the matching template to the newly registered participant", async () => {
      const event = await createEvent();
      const template = await createEmailTemplate(
        event.uuid,
        EmailTrigger.PARTICIPANT_REGISTERED,
      );

      await listeners.handleParticipantRegisteredEvent(
        new ParticipantRegisteredEvent("participant-uuid", event.uuid),
      );

      expect(
        mockEmailDeliveryService.sendEmailToParticipants,
      ).toHaveBeenCalledWith(template.uuid, ["participant-uuid"]);
    });

    it("does not send when no PARTICIPANT_REGISTERED template exists for the event", async () => {
      const event = await createEvent();
      await createEmailTemplate(event.uuid, EmailTrigger.MANUAL);

      await listeners.handleParticipantRegisteredEvent(
        new ParticipantRegisteredEvent("participant-uuid", event.uuid),
      );

      expect(
        mockEmailDeliveryService.sendEmailToParticipants,
      ).not.toHaveBeenCalled();
    });

    it("ignores templates belonging to a different event", async () => {
      const event = await createEvent();
      const otherEvent = await createEvent();
      await createEmailTemplate(
        otherEvent.uuid,
        EmailTrigger.PARTICIPANT_REGISTERED,
      );

      await listeners.handleParticipantRegisteredEvent(
        new ParticipantRegisteredEvent("participant-uuid", event.uuid),
      );

      expect(
        mockEmailDeliveryService.sendEmailToParticipants,
      ).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // participant.deleted
  // ---------------------------------------------------------------------------

  describe("handleParticipantDeletedEvent", () => {
    it("sends the matching template using the deleted-participant snapshot", async () => {
      const event = await createEvent();
      const template = await createEmailTemplate(
        event.uuid,
        EmailTrigger.PARTICIPANT_DELETED,
      );
      const snapshot = {
        uuid: "participant-uuid",
        email: "deleted@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
        attributes: [],
      };

      await listeners.handleParticipantDeletedEvent(
        new ParticipantDeletedEvent(snapshot, event.uuid),
      );

      expect(
        mockEmailDeliveryService.sendEmailToParticipants,
      ).toHaveBeenCalledWith(template.uuid, ["participant-uuid"], snapshot);
    });
  });

  // ---------------------------------------------------------------------------
  // form.filled
  // ---------------------------------------------------------------------------

  describe("handleFormFilledEvent", () => {
    it("sends when triggerConfig.formUuid matches, after a real Postgres JSON round-trip", async () => {
      const event = await createEvent();
      const template = await createEmailTemplate(
        event.uuid,
        EmailTrigger.FORM_FILLED,
        { formUuid: "form-uuid-1" },
      );

      await listeners.handleFormFilledEvent(
        new FormFilledEvent("form-uuid-1", "participant-uuid", event.uuid),
      );

      expect(
        mockEmailDeliveryService.sendEmailToParticipants,
      ).toHaveBeenCalledWith(template.uuid, ["participant-uuid"]);
    });

    it("does not send when triggerConfig.formUuid does not match", async () => {
      const event = await createEvent();
      await createEmailTemplate(event.uuid, EmailTrigger.FORM_FILLED, {
        formUuid: "form-uuid-1",
      });

      await listeners.handleFormFilledEvent(
        new FormFilledEvent("form-uuid-2", "participant-uuid", event.uuid),
      );

      expect(
        mockEmailDeliveryService.sendEmailToParticipants,
      ).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // attribute.changed
  // ---------------------------------------------------------------------------

  describe("handleAttributeChangedEvent", () => {
    it("sends when triggerConfig.attributeUuid and expectedValue both match, after a real Postgres JSON round-trip", async () => {
      const event = await createEvent();
      const template = await createEmailTemplate(
        event.uuid,
        EmailTrigger.ATTRIBUTE_CHANGED,
        { attributeUuid: "attribute-uuid-1", expectedValue: "confirmed" },
      );

      await listeners.handleAttributeChangedEvent(
        new AttributeChangedEvent(
          "attribute-uuid-1",
          "participant-uuid",
          event.uuid,
          "confirmed",
        ),
      );

      expect(
        mockEmailDeliveryService.sendEmailToParticipants,
      ).toHaveBeenCalledWith(template.uuid, ["participant-uuid"]);
    });

    it("does not send when expectedValue does not match", async () => {
      const event = await createEvent();
      await createEmailTemplate(event.uuid, EmailTrigger.ATTRIBUTE_CHANGED, {
        attributeUuid: "attribute-uuid-1",
        expectedValue: "confirmed",
      });

      await listeners.handleAttributeChangedEvent(
        new AttributeChangedEvent(
          "attribute-uuid-1",
          "participant-uuid",
          event.uuid,
          "declined",
        ),
      );

      expect(
        mockEmailDeliveryService.sendEmailToParticipants,
      ).not.toHaveBeenCalled();
    });
  });
});
