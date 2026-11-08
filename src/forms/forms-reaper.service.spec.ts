import { PrismaService } from "src/prisma/prisma.service";
import { StorageService } from "src/storage/storage.service";

import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";

import { FormsReaperService } from "./forms-reaper.service";

describe("FormsReaperService", () => {
  let service: FormsReaperService;

  const mockPrismaService = {
    uploadedFile: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockStorageService = {
    delete: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === "S3_BUCKET_FORMS") {
        return "forms";
      }
      if (key === "UPLOAD_TTL_HOURS") {
        return 24;
      }
      throw new Error(`Unexpected config key requested in test: ${key}`);
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormsReaperService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<FormsReaperService>(FormsReaperService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("reapExpiredFiles", () => {
    it("reads the TTL from ConfigService (not from a raw Postgres query)", async () => {
      mockPrismaService.uploadedFile.findMany.mockResolvedValue([]);

      await service.reapExpiredFiles();

      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
        "UPLOAD_TTL_HOURS",
      );
      expect(mockPrismaService.uploadedFile.findMany).toHaveBeenCalledWith({
        where: {
          claimedAt: null,
          createdAt: { lt: expect.any(Date) as Date },
        },
      });
    });

    it("deletes expired files from storage and removes their DB rows", async () => {
      const expiredFiles = [
        { uuid: "file-1", fileKey: "key-1.png" },
        { uuid: "file-2", fileKey: "key-2.png" },
      ];
      mockPrismaService.uploadedFile.findMany.mockResolvedValue(expiredFiles);

      await service.reapExpiredFiles();

      expect(mockStorageService.delete).toHaveBeenCalledWith(
        "forms",
        "key-1.png",
      );
      expect(mockStorageService.delete).toHaveBeenCalledWith(
        "forms",
        "key-2.png",
      );
      expect(mockPrismaService.uploadedFile.deleteMany).toHaveBeenCalledWith({
        where: { uuid: { in: ["file-1", "file-2"] } },
      });
    });

    it("does nothing when there are no expired files", async () => {
      mockPrismaService.uploadedFile.findMany.mockResolvedValue([]);

      await service.reapExpiredFiles();

      expect(mockStorageService.delete).not.toHaveBeenCalled();
      expect(mockPrismaService.uploadedFile.deleteMany).not.toHaveBeenCalled();
    });

    it("still removes the DB row even when the S3 delete fails for one file", async () => {
      const expiredFiles = [{ uuid: "file-1", fileKey: "key-1.png" }];
      mockPrismaService.uploadedFile.findMany.mockResolvedValue(expiredFiles);
      mockStorageService.delete.mockRejectedValue(new Error("S3 down"));

      await service.reapExpiredFiles();

      expect(mockPrismaService.uploadedFile.deleteMany).toHaveBeenCalledWith({
        where: { uuid: { in: ["file-1"] } },
      });
    });
  });
});
