import { ConfigService } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { StorageService } from "./storage.service";

describe("StorageService", () => {
  let service: StorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StorageService, ConfigService],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("extractKey", () => {
    const bucket = "test-bucket";

    it("returns the value unchanged when it has no URL prefix", () => {
      expect(service.extractKey(bucket, "some-key.png")).toBe("some-key.png");
    });

    it("strips a single matching URL prefix", () => {
      const url = service.getUrl(bucket, "some-key.png");
      expect(service.extractKey(bucket, url)).toBe("some-key.png");
    });

    it("strips a doubled URL prefix, self-healing an already-corrupted value", () => {
      const doubled = service.getUrl(
        bucket,
        service.getUrl(bucket, "some-key.png"),
      );
      expect(service.extractKey(bucket, doubled)).toBe("some-key.png");
    });
  });
});
