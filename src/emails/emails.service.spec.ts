import { EmailTrigger } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import { BadRequestException } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import type { CreateEmailDto } from "./dto/create-email.dto";
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
    it("should throw BadRequestException when provided eventId does not exist", async () => {
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
});

function mockTransaction(mockPrismaService: { $transaction: jest.Mock }) {
  mockPrismaService.$transaction.mockImplementation(
    async (callback: (tx: typeof mockPrismaService) => Promise<unknown>) => {
      return await callback(mockPrismaService);
    },
  );
}
