import { MailerService } from "@nestjs-modules/mailer";
import { EmailStatus, EmailTrigger } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import { getQueueToken } from "@nestjs/bullmq";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import type { CreateEmailDto } from "./dto/create-email.dto";
import { EmailListingDto } from "./dto/email-listing.dto";
import type { UpdateEmailDto } from "./dto/update-email.dto";
import { EmailsController } from "./emails.controller";
import { EmailsService } from "./emails.service";

describe("EmailsController", () => {
  let controller: EmailsController;
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
      ],
      controllers: [EmailsController],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    controller = module.get<EmailsController>(EmailsController);

    mockPrismaService.$transaction.mockImplementation(async (argument) => {
      if (Array.isArray(argument)) {
        return Promise.all(argument);
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      return argument(mockPrismaService);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("find all emails by event", () => {
    it("should return a paginated list of email templates", async () => {
      const query: EmailListingDto = {
        skip: 0,
        take: 10,
        sort: "createdAt:desc",
      };
      const mockDate = new Date();

      const mockPrismaOutput = [
        {
          uuid: mockEmailId,
          eventUuid: mockEventId,
          name: "<p>test</p>",
          trigger: EmailTrigger.MANUAL,
          triggerConfig: undefined,

          createdAt: mockDate,
          updatedAt: mockDate,
          participantEmails: [
            { status: EmailStatus.sent },
            { status: EmailStatus.sent },
            { status: EmailStatus.failed },
          ],
        },
      ];

      mockPrismaService.event.findUnique.mockResolvedValue({
        uuid: mockEventId,
      });
      mockPrismaService.emailTemplate.count.mockResolvedValue(
        mockPrismaOutput.length,
      );
      mockPrismaService.emailTemplate.findMany.mockResolvedValue(
        mockPrismaOutput,
      );

      const result = await controller.findAll(mockEventId, query);

      expect(result.meta.itemCount).toEqual(1);
      expect(result.data).toHaveLength(1);

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          id: mockEmailId,
          name: "<p>test</p>",
          meta: {
            sentCount: 2,
            failedCount: 1,
            pendingCount: 0,
          },
        }),
      );

      expect(mockPrismaService.emailTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          where: expect.objectContaining({
            eventUuid: mockEventId,
          }),
          take: 10,
          skip: 0,
          orderBy: [{ createdAt: "desc" }],
        }),
      );
    });

    it("should throw BadRequestException if the event does not exist", async () => {
      const query = new EmailListingDto();
      mockPrismaService.event.findUnique.mockResolvedValue(null);

      await expect(controller.findAll(mockEventId, query)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockPrismaService.emailTemplate.count).not.toHaveBeenCalled();
      expect(mockPrismaService.emailTemplate.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("create an email template", () => {
    it("should successfully create and return the email template", async () => {
      const dto: CreateEmailDto = {
        name: "test",
        content: "<p>Hello</p>",
        trigger: EmailTrigger.MANUAL,
      };

      const mockPrismaOutput = {
        uuid: mockEmailId,
        eventUuid: mockEventId,
        name: dto.name,
        content: dto.content,
        trigger: dto.trigger,
        triggerConfig: undefined,

        order: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.event.findUnique.mockResolvedValue({
        uuid: mockEventId,
      });
      mockPrismaService.emailTemplate.create.mockResolvedValue(
        mockPrismaOutput,
      );

      const result = await controller.create(mockEventId, dto);

      expect(result.id).toEqual(mockEmailId);
      expect(result.name).toEqual("test");
      expect(mockPrismaService.emailTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            name: "test",
            content: "<p>Hello</p>",
          }),
        }),
      );
    });

    it("should throw BadRequestException when the event doesn't exist", async () => {
      const dto: CreateEmailDto = {
        name: "test",
        content: "<p>test</p>",
        trigger: EmailTrigger.MANUAL,
      };
      mockPrismaService.event.findUnique.mockResolvedValue(null);

      await expect(controller.create(mockEventId, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.emailTemplate.create).not.toHaveBeenCalled();
    });
  });

  describe("find one email by event", () => {
    it("should return a complete email template with participants", async () => {
      const mockPrismaOutput = {
        uuid: mockEmailId,
        eventUuid: mockEventId,
        name: "Single Email",
        content: "<p>Content</p>",
        trigger: EmailTrigger.MANUAL,
        triggerConfig: undefined,

        order: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        participantEmails: [],
      };

      mockPrismaService.emailTemplate.findFirst.mockResolvedValue(
        mockPrismaOutput,
      );

      const result = await controller.findOne(mockEventId, mockEmailId);

      expect(result.id).toEqual(mockEmailId);
      expect(result.name).toEqual("Single Email");
      expect(result.participants).toEqual([]);
    });

    it("should throw NotFoundException when the email does not exist", async () => {
      mockPrismaService.emailTemplate.findFirst.mockResolvedValue(null);

      await expect(
        controller.findOne(mockEventId, mockEmailId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("update an email template", () => {
    it("should update and return the email template", async () => {
      const dto: UpdateEmailDto = { name: "test2" };

      mockPrismaService.emailTemplate.findFirst.mockResolvedValue({
        uuid: mockEmailId,
      });

      const mockUpdatedOutput = {
        uuid: mockEmailId,
        eventUuid: mockEventId,
        name: "test2",
        content: "<p>test</p>",
        trigger: EmailTrigger.MANUAL,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.emailTemplate.update.mockResolvedValue(
        mockUpdatedOutput,
      );

      const result = await controller.update(mockEventId, mockEmailId, dto);

      expect(result.name).toEqual("test2");
      expect(mockPrismaService.emailTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: mockEmailId },
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({ name: "test2" }),
        }),
      );
    });
    it("should throw NotFoundException when event or email does not exist", async () => {
      const dto: UpdateEmailDto = { name: "test" };
      mockPrismaService.emailTemplate.findFirst.mockResolvedValue(null);
      await expect(
        controller.update(mockEventId, mockEmailId, dto),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.emailTemplate.update).not.toHaveBeenCalled();
    });
  });

  describe("delete an email template", () => {
    it("should delete the email and return void", async () => {
      mockPrismaService.emailTemplate.findFirst.mockResolvedValue({
        uuid: mockEmailId,
      });
      mockPrismaService.emailTemplate.delete.mockResolvedValue({
        uuid: mockEmailId,
      });

      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      const result = await controller.remove(mockEventId, mockEmailId);

      expect(result).toBeUndefined();
      expect(mockPrismaService.emailTemplate.delete).toHaveBeenCalledWith({
        where: { uuid: mockEmailId },
      });
    });
    it("should throw NotFoundException and prevent database deletion", async () => {
      mockPrismaService.emailTemplate.findFirst.mockResolvedValue(null);

      await expect(controller.remove(mockEventId, mockEmailId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.emailTemplate.delete).not.toHaveBeenCalled();
    });
  });
});
