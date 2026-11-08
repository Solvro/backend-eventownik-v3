import { FormFilledEvent } from "src/common/events/form-filled.event";
import { ParticipantRegisteredEvent } from "src/common/events/participant-registered.event";
import { EmailTrigger } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { EmailDeliveryService } from "./email-delivery.service";
import { EmailsListeners } from "./emails.listeners";

describe("EmailsListeners", () => {
  let listeners: EmailsListeners;
  let findManyMock: jest.Mock;
  let sendEmailMock: jest.Mock;

  beforeEach(async () => {
    findManyMock = jest.fn();
    sendEmailMock = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailsListeners,
        {
          provide: EmailDeliveryService,
          useValue: {
            sendEmailToParticipants: sendEmailMock,
          },
        },
        {
          provide: PrismaService,
          useValue: {
            emailTemplate: {
              findMany: findManyMock,
            },
          },
        },
      ],
    }).compile();

    listeners = module.get<EmailsListeners>(EmailsListeners);
  });

  it("should be defined", () => {
    expect(listeners).toBeDefined();
  });

  describe("handleParticipantRegisteredEvent", () => {
    it("should send email to the registered participant if template exists", async () => {
      const event = new ParticipantRegisteredEvent(
        "participant-uuid",
        "event-uuid",
      );
      const templateUuid = "template-uuid";

      findManyMock.mockResolvedValue([
        { uuid: templateUuid, trigger: EmailTrigger.PARTICIPANT_REGISTERED },
      ]);

      await listeners.handleParticipantRegisteredEvent(event);

      expect(findManyMock).toHaveBeenCalledWith({
        where: {
          eventUuid: event.eventUuid,
          trigger: EmailTrigger.PARTICIPANT_REGISTERED,
        },
      });
      expect(sendEmailMock).toHaveBeenCalledWith(templateUuid, [
        event.participantUuid,
      ]);
    });
  });

  describe("handleFormFilledEvent", () => {
    it("should send email to the participant if config matches formUuid", async () => {
      const event = new FormFilledEvent(
        "form-uuid",
        "participant-uuid",
        "event-uuid",
      );
      const templateUuid = "template-uuid";

      findManyMock.mockResolvedValue([
        {
          uuid: templateUuid,
          trigger: EmailTrigger.FORM_FILLED,
          triggerConfig: { formUuid: "form-uuid" },
        },
      ]);

      await listeners.handleFormFilledEvent(event);

      expect(sendEmailMock).toHaveBeenCalledWith(templateUuid, [
        event.participantUuid,
      ]);
    });

    it("should not send email if config formUuid does not match", async () => {
      const event = new FormFilledEvent(
        "form-uuid-1",
        "participant-uuid",
        "event-uuid",
      );
      const templateUuid = "template-uuid";

      findManyMock.mockResolvedValue([
        {
          uuid: templateUuid,
          trigger: EmailTrigger.FORM_FILLED,
          triggerConfig: { formUuid: "form-uuid-2" },
        },
      ]);

      await listeners.handleFormFilledEvent(event);

      expect(sendEmailMock).not.toHaveBeenCalled();
    });
  });
});
