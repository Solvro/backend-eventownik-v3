import { FormFilledEvent } from "src/common/events/form-filled.event";
import { ParticipantRegisteredEvent } from "src/common/events/participant-registered.event";
import { EmailTrigger } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import { Test, TestingModule } from "@nestjs/testing";

import { EmailsListeners } from "./emails.listeners";
import { EmailsService } from "./emails.service";

describe("EmailsListeners", () => {
  let listeners: EmailsListeners;
  let emailsService: EmailsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailsListeners,
        {
          provide: EmailsService,
          useValue: {
            sendEmailToParticipants: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            emailTemplate: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    listeners = module.get<EmailsListeners>(EmailsListeners);
    emailsService = module.get<EmailsService>(EmailsService);
    prisma = module.get<PrismaService>(PrismaService);
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

      (prisma.emailTemplate.findMany as jest.Mock).mockResolvedValue([
        { uuid: templateUuid, trigger: EmailTrigger.PARTICIPANT_REGISTERED },
      ]);

      await listeners.handleParticipantRegisteredEvent(event);

      expect(prisma.emailTemplate.findMany).toHaveBeenCalledWith({
        where: {
          eventUuid: event.eventUuid,
          trigger: EmailTrigger.PARTICIPANT_REGISTERED,
        },
      });
      expect(emailsService.sendEmailToParticipants).toHaveBeenCalledWith(
        templateUuid,
        [event.participantUuid],
      );
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

      (prisma.emailTemplate.findMany as jest.Mock).mockResolvedValue([
        {
          uuid: templateUuid,
          trigger: EmailTrigger.FORM_FILLED,
          triggerConfig: { formUuid: "form-uuid" },
        },
      ]);

      await listeners.handleFormFilledEvent(event);

      expect(emailsService.sendEmailToParticipants).toHaveBeenCalledWith(
        templateUuid,
        [event.participantUuid],
      );
    });

    it("should not send email if config formUuid does not match", async () => {
      const event = new FormFilledEvent(
        "form-uuid-1",
        "participant-uuid",
        "event-uuid",
      );
      const templateUuid = "template-uuid";

      (prisma.emailTemplate.findMany as jest.Mock).mockResolvedValue([
        {
          uuid: templateUuid,
          trigger: EmailTrigger.FORM_FILLED,
          triggerConfig: { formUuid: "form-uuid-2" },
        },
      ]);

      await listeners.handleFormFilledEvent(event);

      expect(emailsService.sendEmailToParticipants).not.toHaveBeenCalled();
    });
  });
});
