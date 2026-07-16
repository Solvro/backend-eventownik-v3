import { MailerService } from "@nestjs-modules/mailer";
import { PageOptionsDto } from "src/common/dto/page-options.dto";
import { EmailStatus } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import { getQueueToken } from "@nestjs/bullmq";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { EmailContentParserService } from "./email-content-parser.service";
import { EmailDeliveryService } from "./email-delivery.service";
import { EMAIL_QUEUE_NAME } from "./emails.constants";

describe("EmailDeliveryService", () => {
  let service: EmailDeliveryService;

  const mockPrismaService = {
    emailTemplate: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    participant: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    participantEmailStatus: {
      createMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockMailerService = {
    sendMail: jest.fn(),
  };

  const mockQueue = {
    addBulk: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockContentParser = {
    parseEmailContent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailDeliveryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MailerService, useValue: mockMailerService },
        { provide: getQueueToken(EMAIL_QUEUE_NAME), useValue: mockQueue },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EmailContentParserService, useValue: mockContentParser },
      ],
    }).compile();

    service = module.get<EmailDeliveryService>(EmailDeliveryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("sendEmailToParticipants", () => {
    it("creates pending status rows and enqueues one job per participant", async () => {
      await service.sendEmailToParticipants("email-uuid", [
        "participant-1",
        "participant-2",
      ]);

      expect(
        mockPrismaService.participantEmailStatus.createMany,
      ).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            status: EmailStatus.pending,
            participantUuid: "participant-1",
            emailUuid: "email-uuid",
          }),
          expect.objectContaining({
            status: EmailStatus.pending,
            participantUuid: "participant-2",
            emailUuid: "email-uuid",
          }),
        ],
      });

      expect(mockQueue.addBulk).toHaveBeenCalledTimes(1);
      const [jobs] = mockQueue.addBulk.mock.calls[0] as [
        { data: { participantUuid: string; statusUuid: string } }[],
      ];
      expect(jobs).toHaveLength(2);
      expect(jobs[0].data.participantUuid).toEqual("participant-1");
      expect(jobs[0].data.statusUuid).toEqual(expect.any(String));
    });

    it("records the pending status unlinked when a participant snapshot is given", async () => {
      const snapshot = {
        uuid: "participant-1",
        email: "a@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
        attributes: [],
      };

      await service.sendEmailToParticipants(
        "email-uuid",
        ["participant-1"],
        snapshot,
      );

      expect(
        mockPrismaService.participantEmailStatus.createMany,
      ).toHaveBeenCalledWith({
        data: [expect.objectContaining({ participantUuid: null })],
      });
    });

    it("does nothing when the participant list is empty", async () => {
      await service.sendEmailToParticipants("email-uuid", []);

      expect(
        mockPrismaService.participantEmailStatus.createMany,
      ).not.toHaveBeenCalled();
      expect(mockQueue.addBulk).not.toHaveBeenCalled();
    });
  });

  describe("deliverEmailToParticipants", () => {
    const emailTemplate = {
      uuid: "email-uuid",
      name: "Subject",
      content: "<p>Hi</p>",
      event: { contactEmail: null, attributes: [], forms: [] },
    };
    const participant = {
      uuid: "participant-1",
      email: "a@example.com",
      attributes: [],
    };

    it("marks the status sent on successful delivery", async () => {
      mockPrismaService.emailTemplate.findUnique.mockResolvedValue(
        emailTemplate,
      );
      mockPrismaService.participant.findUnique.mockResolvedValue(participant);
      mockContentParser.parseEmailContent.mockReturnValue({
        html: "<p>Hi</p>",
        attachments: [],
      });

      await service.deliverEmailToParticipants(
        "email-uuid",
        "participant-1",
        "status-uuid",
      );

      expect(mockMailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "a@example.com" }),
      );
      expect(
        mockPrismaService.participantEmailStatus.updateMany,
      ).toHaveBeenCalledWith({
        where: { uuid: "status-uuid" },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({ status: EmailStatus.sent }),
      });
    });

    it("marks the status failed and rethrows when sending fails, so the queue retries", async () => {
      mockPrismaService.emailTemplate.findUnique.mockResolvedValue(
        emailTemplate,
      );
      mockPrismaService.participant.findUnique.mockResolvedValue(participant);
      mockContentParser.parseEmailContent.mockReturnValue({
        html: "<p>Hi</p>",
        attachments: [],
      });
      mockMailerService.sendMail.mockRejectedValue(new Error("SMTP down"));

      await expect(
        service.deliverEmailToParticipants(
          "email-uuid",
          "participant-1",
          "status-uuid",
        ),
      ).rejects.toThrow("SMTP down");

      expect(
        mockPrismaService.participantEmailStatus.updateMany,
      ).toHaveBeenCalledWith({
        where: { uuid: "status-uuid" },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({ status: EmailStatus.failed }),
      });
    });

    it("marks failed and throws NotFoundException when the participant no longer exists", async () => {
      mockPrismaService.emailTemplate.findUnique.mockResolvedValue(
        emailTemplate,
      );
      mockPrismaService.participant.findUnique.mockResolvedValue(null);

      await expect(
        service.deliverEmailToParticipants(
          "email-uuid",
          "participant-1",
          "status-uuid",
        ),
      ).rejects.toThrow(NotFoundException);

      expect(
        mockPrismaService.participantEmailStatus.updateMany,
      ).toHaveBeenCalledWith({
        where: { uuid: "status-uuid" },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({ status: EmailStatus.failed }),
      });
      expect(mockMailerService.sendMail).not.toHaveBeenCalled();
    });

    it("uses the provided snapshot instead of querying for the participant", async () => {
      mockPrismaService.emailTemplate.findUnique.mockResolvedValue(
        emailTemplate,
      );
      mockContentParser.parseEmailContent.mockReturnValue({
        html: "<p>Hi</p>",
        attachments: [],
      });

      const snapshot = {
        uuid: "participant-1",
        email: "deleted@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
        attributes: [],
      };

      await service.deliverEmailToParticipants(
        "email-uuid",
        "participant-1",
        "status-uuid",
        snapshot,
      );

      expect(mockPrismaService.participant.findUnique).not.toHaveBeenCalled();
      expect(mockMailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "deleted@example.com" }),
      );
    });
  });

  describe("sendManualEmail", () => {
    it("throws BadRequestException when a participant does not belong to the event", async () => {
      mockPrismaService.emailTemplate.findFirst.mockResolvedValue({
        uuid: "email-uuid",
      });
      mockPrismaService.participant.count.mockResolvedValue(1);

      await expect(
        service.sendManualEmail("event-uuid", "email-uuid", [
          "participant-1",
          "participant-2",
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws NotFoundException when the email template does not exist", async () => {
      mockPrismaService.emailTemplate.findFirst.mockResolvedValue(null);

      await expect(
        service.sendManualEmail("event-uuid", "email-uuid", ["participant-1"]),
      ).rejects.toThrow(NotFoundException);
    });

    it("dedupes duplicate participant UUIDs before validating and sending", async () => {
      mockPrismaService.emailTemplate.findFirst.mockResolvedValue({
        uuid: "email-uuid",
      });
      mockPrismaService.participant.count.mockResolvedValue(2);

      await service.sendManualEmail("event-uuid", "email-uuid", [
        "participant-1",
        "participant-1",
        "participant-2",
      ]);

      expect(mockPrismaService.participant.count).toHaveBeenCalledWith({
        where: {
          uuid: { in: ["participant-1", "participant-2"] },
          eventUuid: "event-uuid",
        },
      });
      expect(
        mockPrismaService.participantEmailStatus.createMany,
      ).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ participantUuid: "participant-1" }),
          expect.objectContaining({ participantUuid: "participant-2" }),
        ],
      });
    });
  });

  describe("sendTestEmail", () => {
    it("sends synchronously to the given address using a placeholder participant", async () => {
      mockPrismaService.emailTemplate.findFirst.mockResolvedValue({
        uuid: "email-uuid",
        name: "Subject",
        event: { contactEmail: null, attributes: [], forms: [] },
      });
      mockContentParser.parseEmailContent.mockReturnValue({
        html: "<p>Hi</p>",
        attachments: [],
      });

      await service.sendTestEmail("event-uuid", "email-uuid", "me@example.com");

      expect(mockPrismaService.participant.findFirst).not.toHaveBeenCalled();
      expect(mockMailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "me@example.com" }),
      );
      expect(
        mockPrismaService.participantEmailStatus.createMany,
      ).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when the given participant is not in this event", async () => {
      mockPrismaService.emailTemplate.findFirst.mockResolvedValue({
        uuid: "email-uuid",
        name: "Subject",
        event: { contactEmail: null, attributes: [], forms: [] },
      });
      mockPrismaService.participant.findFirst.mockResolvedValue(null);

      await expect(
        service.sendTestEmail(
          "event-uuid",
          "email-uuid",
          "me@example.com",
          "participant-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("findParticipantsForEmail", () => {
    it("returns flattened status/sendAt/sendBy fields", async () => {
      mockPrismaService.emailTemplate.findFirst.mockResolvedValue({
        uuid: "email-uuid",
      });
      mockPrismaService.$transaction.mockResolvedValue([
        1,
        [
          {
            status: EmailStatus.sent,
            sendAt: new Date("2025-02-22T19:13:10.471Z"),
            sendBy: "Jan Kowalski",
            participant: {
              uuid: "participant-1",
              email: "a@example.com",
              createdAt: new Date("2025-02-22T19:13:10.471Z"),
              updatedAt: new Date("2025-02-22T19:13:10.471Z"),
            },
          },
        ],
      ]);

      const result = await service.findParticipantsForEmail(
        "event-uuid",
        "email-uuid",
        new PageOptionsDto(),
      );

      expect(result.data[0]).toEqual({
        id: "participant-1",
        email: "a@example.com",
        createdAt: "2025-02-22T19:13:10.471Z",
        updatedAt: "2025-02-22T19:13:10.471Z",
        status: EmailStatus.sent,
        sendAt: "2025-02-22T19:13:10.471Z",
        sendBy: "Jan Kowalski",
      });
    });
  });
});
