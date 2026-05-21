import { MailerService } from "@nestjs-modules/mailer";
import { EmailStatus, EmailTrigger } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import { getQueueToken } from "@nestjs/bullmq";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import type { CreateEmailDto } from "./dto/create-email.dto";
import type { EmailListingDto } from "./dto/email-listing.dto";
import type { UpdateEmailDto } from "./dto/update-email.dto";
import { EmailsService } from "./emails.service";

describe("EmailsService", () => {
  let service: EmailsService;
  const mockEventId = "event-uuid-123";
  const mockEmailId = "email-uuid-123";

  const mockPrismaService = {
    event: {
      findUnique: jest.fn(),
    },
    form: {
      findUnique: jest.fn(),
    },
    emailTemplate: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockMailerService = {
    sendMail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailsService,
        PrismaService,
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
        {
          provide: getQueueToken("automatic-emails"),
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    service = module.get<EmailsService>(EmailsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    it("should create a new email template", async () => {
      const dto: CreateEmailDto = {
        name: "Name",
        content: "Content",
        trigger: EmailTrigger.MANUAL,
      };

      mockTransaction(mockPrismaService);

      mockPrismaService.event.findUnique.mockResolvedValue({
        uuid: mockEventId,
      });

      mockPrismaService.emailTemplate.create.mockResolvedValue({
        uuid: mockEmailId,
        name: dto.name,
        content: dto.content,
        trigger: dto.trigger,
        eventId: mockEventId,
        createdAt: new Date("2025-02-22T19:13:10.471Z"),
        updatedAt: new Date("2025-02-22T19:13:10.471Z"),
      });

      const result = await service.create(mockEventId, dto);

      expect(mockPrismaService.emailTemplate.create).toHaveBeenCalledWith({
        data: {
          name: dto.name,
          content: dto.content,
          trigger: dto.trigger,
          triggerConfig: {},
          order: undefined,
          eventUuid: mockEventId,
        },
      });

      expect(result.id).toEqual(mockEmailId);
    });
    it("should throw BadRequestException when an event with provided eventId does not exist", async () => {
      const dto = {
        name: "Name",
        content: "Content",
        trigger: EmailTrigger.MANUAL,
      };
      mockPrismaService.event.findUnique.mockResolvedValue(null);
      mockTransaction(mockPrismaService);
      await expect(
        service.create(mockEventId, dto as CreateEmailDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("findAll", () => {
    it("should return paginated email templates with a default sort", async () => {
      const query = {
        page: 1,
        take: 10,
        skip: 0,
      } as EmailListingDto;

      const mockPrismaOutput = [
        {
          uuid: "email-uuid-123",
          eventUuid: "event-uuid-123",
          name: "test124",
          trigger: EmailTrigger.PARTICIPANT_REGISTERED,
          triggerConfig: undefined,

          createdAt: new Date("2025-02-22T19:13:10.471Z"),
          updatedAt: new Date("2025-02-22T19:13:10.471Z"),
          participantEmails: [
            { status: EmailStatus.sent },
            { status: EmailStatus.failed },
          ],
        },
        {
          uuid: "email-uuid-234",
          eventUuid: "event-uuid-123",
          name: "test245",
          trigger: EmailTrigger.MANUAL,
          triggerConfig: undefined,

          createdAt: new Date("2025-02-22T19:13:10.471Z"),
          updatedAt: new Date("2025-02-22T19:13:10.471Z"),
          participantEmails: [
            { status: EmailStatus.sent },
            { status: EmailStatus.failed },
          ],
        },
      ];

      const expectedOutput = [
        {
          id: "email-uuid-123",
          eventId: mockEventId,
          name: "test124",
          trigger: EmailTrigger.PARTICIPANT_REGISTERED,
          triggerConfig: undefined,

          createdAt: "2025-02-22T19:13:10.471Z",
          updatedAt: "2025-02-22T19:13:10.471Z",
          meta: {
            failedCount: 1,
            pendingCount: 0,
            sentCount: 1,
          },
        },
        {
          id: "email-uuid-234",
          eventId: mockEventId,
          name: "test245",
          trigger: EmailTrigger.MANUAL,
          triggerConfig: undefined,

          createdAt: "2025-02-22T19:13:10.471Z",
          updatedAt: "2025-02-22T19:13:10.471Z",
          meta: {
            failedCount: 1,
            pendingCount: 0,
            sentCount: 1,
          },
        },
      ];

      mockPrismaService.event.findUnique.mockResolvedValue(mockEventId);
      mockPrismaService.$transaction.mockResolvedValue([
        mockPrismaOutput.length,
        mockPrismaOutput,
      ]);

      const result = await service.findAll(mockEventId, query);

      expect(mockPrismaService.emailTemplate.findMany).toHaveBeenCalledWith({
        where: { eventUuid: mockEventId },
        skip: query.skip,
        take: query.take,
        orderBy: [{ createdAt: "desc" }],
        select: {
          uuid: true,
          eventUuid: true,
          name: true,
          trigger: true,
          triggerConfig: true,
          schema: true,
          createdAt: true,
          updatedAt: true,
          participantEmails: {
            select: { status: true },
          },
        },
      });
      expect(result.data).toEqual(expectedOutput);
      expect(result.meta.itemCount).toBe(expectedOutput.length);
    });

    it("should return filtered and paginated email templates", async () => {
      const query = {
        page: 1,
        take: 10,
        skip: 0,
        trigger: EmailTrigger.MANUAL,
      } as EmailListingDto;

      const mockPrismaOutput = [
        {
          uuid: "email-uuid-234",
          eventUuid: "event-uuid-123",
          name: "test245",
          trigger: EmailTrigger.MANUAL,
          triggerConfig: undefined,

          createdAt: new Date("2025-02-22T19:13:10.471Z"),
          updatedAt: new Date("2025-02-22T19:13:10.471Z"),
          participantEmails: [
            { status: EmailStatus.sent },
            { status: EmailStatus.failed },
          ],
        },
      ];

      const expectedOutput = [
        {
          id: "email-uuid-234",
          eventId: mockEventId,
          name: "test245",
          trigger: EmailTrigger.MANUAL,
          triggerConfig: undefined,

          createdAt: "2025-02-22T19:13:10.471Z",
          updatedAt: "2025-02-22T19:13:10.471Z",
          meta: {
            failedCount: 1,
            pendingCount: 0,
            sentCount: 1,
          },
        },
      ];

      mockPrismaService.event.findUnique.mockResolvedValue(mockEventId);
      mockPrismaService.$transaction.mockResolvedValue([
        mockPrismaOutput.length,
        mockPrismaOutput,
      ]);

      const result = await service.findAll(mockEventId, query);

      expect(mockPrismaService.emailTemplate.findMany).toHaveBeenCalledWith({
        where: { eventUuid: mockEventId, trigger: query.trigger },
        skip: query.skip,
        take: query.take,
        orderBy: [{ createdAt: "desc" }],
        select: {
          uuid: true,
          eventUuid: true,
          name: true,
          trigger: true,
          triggerConfig: true,
          schema: true,
          createdAt: true,
          updatedAt: true,
          participantEmails: {
            select: { status: true },
          },
        },
      });
      expect(result.data).toEqual(expectedOutput);
      expect(result.meta.itemCount).toBe(expectedOutput.length);
    });

    it("should throw BadRequestException when an event with provided eventId does not exist", async () => {
      const query = {
        page: 1,
        take: 10,
        skip: 0,
      } as EmailListingDto;

      mockPrismaService.event.findUnique.mockResolvedValue(null);
      await expect(service.findAll(mockEventId, query)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("findOne", () => {
    it("should return an email template for provided emailId and eventId", async () => {
      const mockPrismaOutput = {
        uuid: mockEmailId,
        eventUuid: mockEventId,
        name: "test",
        content: "<p>test</p>",
        trigger: EmailTrigger.MANUAL,
        triggerConfig: undefined,

        order: 0,
        createdAt: new Date("2025-02-22T19:13:10.471Z"),
        updatedAt: new Date("2025-02-22T19:13:10.471Z"),
        participantEmails: [
          {
            uuid: "pivot-uuid-123",
            status: EmailStatus.sent,
            sendAt: new Date("2025-02-22T19:13:10.471Z"),
            createdAt: new Date("2025-02-22T19:13:10.471Z"),
            updatedAt: new Date("2025-02-22T19:13:10.471Z"),
            sendBy: "Jan Kowalski",
            participantUuid: "participant-uuid-123",
            emailUuid: "email-uuid-123",
            participant: {
              uuid: "participant-uuid-123",
              email: "example@example.com",
              eventUuid: "event-uuid-123",
              createdAt: new Date("2025-02-22T19:13:10.471Z"),
              updatedAt: new Date("2025-02-22T19:13:10.471Z"),
            },
          },
        ],
      };
      const expectedOutput = {
        id: mockEmailId,
        eventId: mockEventId,
        name: "test",
        content: "<p>test</p>",
        trigger: EmailTrigger.MANUAL,
        triggerConfig: undefined,

        order: 0,
        createdAt: "2025-02-22T19:13:10.471Z",
        updatedAt: "2025-02-22T19:13:10.471Z",
        participants: [
          {
            id: "participant-uuid-123",
            email: "example@example.com",
            createdAt: "2025-02-22T19:13:10.471Z",
            updatedAt: "2025-02-22T19:13:10.471Z",
            meta: {
              pivot_status: EmailStatus.sent,
              pivot_send_at: "2025-02-22T19:13:10.471Z",
              pivot_send_by: "Jan Kowalski",
            },
          },
        ],
      };

      mockPrismaService.emailTemplate.findFirst.mockResolvedValue(
        mockPrismaOutput,
      );

      const result = await service.findOne(mockEventId, mockEmailId);

      expect(mockPrismaService.emailTemplate.findFirst).toHaveBeenCalledWith({
        where: {
          uuid: mockEmailId,
          eventUuid: mockEventId,
        },
      });
      expect(result).toEqual({
        ...expectedOutput,
        participants: [],
      });
    });

    it("should throw NotFoundException when event with provided eventId does not exist.", async () => {
      mockPrismaService.emailTemplate.findFirst.mockResolvedValue(null);
      await expect(service.findOne(mockEventId, mockEmailId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw NotFoundException when email with provided emailId does not exist.", async () => {
      mockPrismaService.emailTemplate.findFirst.mockResolvedValue(null);
      await expect(service.findOne(mockEventId, mockEmailId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("update", () => {
    it("should update email template and return it", async () => {
      const updateEmailDto: UpdateEmailDto = {
        name: "test2",
        content: "<p>test2</p>",
      };

      const mockPrismaOutput = {
        uuid: mockEmailId,
        eventUuid: mockEventId,
        name: "test",
        content: "<p>test2</p>",
        trigger: EmailTrigger.MANUAL,
        triggerConfig: undefined,

        order: 0,
        createdAt: new Date("2025-02-22T19:13:10.471Z"),
        updatedAt: new Date("2025-02-22T19:13:10.471Z"),
      };
      mockTransaction(mockPrismaService);
      mockPrismaService.emailTemplate.findFirst.mockResolvedValue({
        uuid: mockEmailId,
      });
      mockPrismaService.emailTemplate.update.mockResolvedValue(
        mockPrismaOutput,
      );
      const result = await service.update(
        mockEventId,
        mockEmailId,
        updateEmailDto,
      );

      expect(mockPrismaService.emailTemplate.update).toHaveBeenCalledWith({
        where: {
          uuid: mockEmailId,
        },
        data: {
          name: "test2",
          content: "<p>test2</p>",
          trigger: undefined,
          triggerConfig: {},
          order: undefined,
        },
      });
      expect(result).toEqual({
        id: mockEmailId,
        name: "test",
        content: "<p>test2</p>",
        trigger: EmailTrigger.MANUAL,
        eventId: mockEventId,
        createdAt: "2025-02-22T19:13:10.471Z",
        updatedAt: "2025-02-22T19:13:10.471Z",
      });
    });
    it("should throw NotFoundException when event with provided eventId does not exist.", async () => {
      mockTransaction(mockPrismaService);
      mockPrismaService.emailTemplate.findFirst.mockResolvedValue(null);
      await expect(
        service.update(mockEventId, mockEmailId, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException when email with provided emailId does not exist.", async () => {
      mockTransaction(mockPrismaService);
      mockPrismaService.emailTemplate.findFirst.mockResolvedValue(null);
      await expect(
        service.update(mockEventId, mockEmailId, {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("delete", () => {
    it("should delete the email template and return nothing.", async () => {
      mockTransaction(mockPrismaService);
      mockPrismaService.emailTemplate.findFirst.mockResolvedValue({
        uuid: mockEmailId,
      });
      mockPrismaService.emailTemplate.delete.mockResolvedValue({
        uuid: mockEmailId,
      });

      // Check whether delete() returns undefined.
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      const result = await service.remove(mockEventId, mockEmailId);

      expect(mockPrismaService.emailTemplate.findFirst).toHaveBeenCalledWith({
        where: {
          uuid: mockEmailId,
          eventUuid: mockEventId,
        },
        select: { uuid: true },
      });

      expect(mockPrismaService.emailTemplate.delete).toHaveBeenCalledWith({
        where: { uuid: mockEmailId },
      });

      expect(result).toBeUndefined();
    });

    it("should throw NotFoundException when email or/and event does not exist.", async () => {
      mockTransaction(mockPrismaService);
      mockPrismaService.emailTemplate.findFirst.mockResolvedValue(null);

      await expect(service.remove(mockEventId, mockEmailId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.emailTemplate.delete).not.toHaveBeenCalled();
    });
  });
});

function mockTransaction(mockPrismaService: { $transaction: jest.Mock }) {
  mockPrismaService.$transaction.mockImplementation(
    async (callback: (tx: typeof mockPrismaService) => Promise<unknown>) => {
      return await callback(mockPrismaService);
    },
  );
}
