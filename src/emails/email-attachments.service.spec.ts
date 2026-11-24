import { PrismaService } from "src/prisma/prisma.service";
import { StorageService } from "src/storage/storage.service";

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";

import { EmailAttachmentsService } from "./email-attachments.service";

jest.mock("src/common/utils/detect-file-mime", () => ({
  assertAllowedMimeWithMagicBytes: jest.fn().mockResolvedValue("image/png"),
}));

describe("EmailAttachmentsService", () => {
  let service: EmailAttachmentsService;

  const mockPrismaService = {
    event: { findUnique: jest.fn() },
    emailAttachment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockStorageService = {
    upload: jest.fn(),
    delete: jest.fn(),
    download: jest.fn(),
    uploadBuffer: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      switch (key) {
        case "S3_BUCKET_EMAIL_ATTACHMENTS": {
          return "email-attachments";
        }
        case "EMAIL_ATTACHMENT_MAX_FILE_SIZE": {
          return 5_242_880;
        }
        case "EMAIL_ATTACHMENT_MAX_TOTAL_SIZE": {
          return 20_971_520;
        }
        case "EMAIL_ATTACHMENT_MAX_COUNT": {
          return 5;
        }
        case "EMAIL_ATTACHMENT_ALLOWED_MIME": {
          return "application/pdf,image/png";
        }
        case "EMAIL_ATTACHMENT_TTL_HOURS": {
          return 24;
        }
        default: {
          throw new Error(`Unexpected config key: ${key}`);
        }
      }
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailAttachmentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EmailAttachmentsService>(EmailAttachmentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("upload", () => {
    it("uploads to S3 and creates an unclaimed EmailAttachment", async () => {
      mockPrismaService.event.findUnique.mockResolvedValue({ uuid: "event-1" });
      mockStorageService.upload.mockResolvedValue("key.png");
      mockPrismaService.emailAttachment.create.mockResolvedValue({
        uuid: "att-1",
      });

      const file = {
        originalname: "a.png",
        mimetype: "image/png",
        size: 100,
        buffer: Buffer.from("png"),
      } as Express.Multer.File;

      const result = await service.upload("event-1", file);

      expect(mockStorageService.upload).toHaveBeenCalledWith(
        "email-attachments",
        file,
      );
      expect(mockPrismaService.emailAttachment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fileKey: "key.png",
          emailUuid: null,
        }),
      });
      expect(result.attachmentToken).toBe("att-1");
      expect(typeof result.expiresAt).toBe("number");
    });

    it("rejects files larger than EMAIL_ATTACHMENT_MAX_FILE_SIZE", async () => {
      mockPrismaService.event.findUnique.mockResolvedValue({ uuid: "event-1" });

      await expect(
        service.upload("event-1", {
          originalname: "big.png",
          mimetype: "image/png",
          size: 6_000_000,
          buffer: Buffer.alloc(1),
        } as Express.Multer.File),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("deleteUnclaimed", () => {
    it("rejects claimed attachments", async () => {
      mockPrismaService.event.findUnique.mockResolvedValue({ uuid: "event-1" });
      mockPrismaService.emailAttachment.findUnique.mockResolvedValue({
        uuid: "att-1",
        fileKey: "key.png",
        claimedAt: new Date(),
      });

      await expect(service.deleteUnclaimed("event-1", "att-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(mockStorageService.delete).not.toHaveBeenCalled();
    });

    it("deletes unclaimed attachment from S3 and DB", async () => {
      mockPrismaService.event.findUnique.mockResolvedValue({ uuid: "event-1" });
      mockPrismaService.emailAttachment.findUnique.mockResolvedValue({
        uuid: "att-1",
        fileKey: "key.png",
        claimedAt: null,
      });

      await service.deleteUnclaimed("event-1", "att-1");

      expect(mockStorageService.delete).toHaveBeenCalledWith(
        "email-attachments",
        "key.png",
      );
      expect(mockPrismaService.emailAttachment.delete).toHaveBeenCalledWith({
        where: { uuid: "att-1" },
      });
    });

    it("throws NotFoundException when attachment is missing", async () => {
      mockPrismaService.event.findUnique.mockResolvedValue({ uuid: "event-1" });
      mockPrismaService.emailAttachment.findUnique.mockResolvedValue(null);

      await expect(service.deleteUnclaimed("event-1", "att-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("claimForCreate", () => {
    it("rejects when total size exceeds the limit", async () => {
      const tx = {
        emailAttachment: {
          findMany: jest.fn().mockResolvedValue([
            {
              uuid: "a1",
              size: 15_000_000,
              claimedAt: null,
              emailUuid: null,
            },
            {
              uuid: "a2",
              size: 10_000_000,
              claimedAt: null,
              emailUuid: null,
            },
          ]),
          updateMany: jest.fn(),
        },
      };

      await expect(
        service.claimForCreate("email-1", ["a1", "a2"], tx as never),
      ).rejects.toThrow(BadRequestException);
      expect(tx.emailAttachment.updateMany).not.toHaveBeenCalled();
    });
  });
});
