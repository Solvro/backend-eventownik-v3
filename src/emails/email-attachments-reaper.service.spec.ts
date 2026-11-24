import { PrismaService } from "src/prisma/prisma.service";
import { StorageService } from "src/storage/storage.service";

import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";

import { EmailAttachmentsReaperService } from "./email-attachments-reaper.service";

describe("EmailAttachmentsReaperService", () => {
  let service: EmailAttachmentsReaperService;

  const mockPrismaService = {
    emailAttachment: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockStorageService = {
    delete: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === "S3_BUCKET_EMAIL_ATTACHMENTS") {
        return "email-attachments";
      }
      if (key === "EMAIL_ATTACHMENT_TTL_HOURS") {
        return 24;
      }
      throw new Error(`Unexpected config key requested in test: ${key}`);
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailAttachmentsReaperService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EmailAttachmentsReaperService>(
      EmailAttachmentsReaperService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("reapExpiredAttachments", () => {
    it("reads the TTL from ConfigService", async () => {
      mockPrismaService.emailAttachment.findMany.mockResolvedValue([]);

      await service.reapExpiredAttachments();

      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
        "EMAIL_ATTACHMENT_TTL_HOURS",
      );
      expect(mockPrismaService.emailAttachment.findMany).toHaveBeenCalledWith({
        where: {
          claimedAt: null,
          createdAt: { lt: expect.any(Date) as Date },
        },
      });
    });

    it("deletes expired attachments from storage and removes their DB rows", async () => {
      const expiredAttachments = [
        { uuid: "att-1", fileKey: "key-1.pdf" },
        { uuid: "att-2", fileKey: "key-2.pdf" },
      ];
      mockPrismaService.emailAttachment.findMany.mockResolvedValue(
        expiredAttachments,
      );

      await service.reapExpiredAttachments();

      expect(mockStorageService.delete).toHaveBeenCalledWith(
        "email-attachments",
        "key-1.pdf",
      );
      expect(mockStorageService.delete).toHaveBeenCalledWith(
        "email-attachments",
        "key-2.pdf",
      );
      expect(mockPrismaService.emailAttachment.deleteMany).toHaveBeenCalledWith(
        {
          where: { uuid: { in: ["att-1", "att-2"] } },
        },
      );
    });

    it("does nothing when there are no expired attachments", async () => {
      mockPrismaService.emailAttachment.findMany.mockResolvedValue([]);

      await service.reapExpiredAttachments();

      expect(mockStorageService.delete).not.toHaveBeenCalled();
      expect(
        mockPrismaService.emailAttachment.deleteMany,
      ).not.toHaveBeenCalled();
    });
  });
});
