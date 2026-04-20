import { EmailStatus, EmailTrigger } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import { BadRequestException } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import type { CreateEmailDto } from "./dto/create-email.dto";
import type { EmailListingDto } from "./dto/email-listing.dto";
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailsService, PrismaService],
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
      const dto = {
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
      });

      const result = await service.create(mockEventId, dto as CreateEmailDto);

      expect(mockPrismaService.emailTemplate.create).toHaveBeenCalledWith({
        data: {
          name: dto.name,
          content: dto.content,
          trigger: dto.trigger,
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
          triggerValue: "",
          triggerValue2: "",
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
          triggerValue: "",
          triggerValue2: "",
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
          triggerValue: "",
          triggerValue2: "",
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
          triggerValue: "",
          triggerValue2: "",
          createdAt: "2025-02-22T19:13:10.471Z",
          updatedAt: "2025-02-22T19:13:10.471Z",
          meta: {
            failedCount: 1,
            pendingCount: 0,
            sentCount: 1,
          },
        },
      ];

      mockPrismaService.event.findUnique.mockReturnValue(mockEventId);
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
          triggerValue: true,
          triggerValue2: true,
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
          triggerValue: "",
          triggerValue2: "",
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
          triggerValue: "",
          triggerValue2: "",
          createdAt: "2025-02-22T19:13:10.471Z",
          updatedAt: "2025-02-22T19:13:10.471Z",
          meta: {
            failedCount: 1,
            pendingCount: 0,
            sentCount: 1,
          },
        },
      ];

      mockPrismaService.event.findUnique.mockReturnValue(mockEventId);
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
          triggerValue: true,
          triggerValue2: true,
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
      } as unknown as EmailListingDto;

      mockPrismaService.event.findUnique.mockReturnValue(null);
      await expect(service.findAll(mockEventId, query)).rejects.toThrow(
        BadRequestException,
      );
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
