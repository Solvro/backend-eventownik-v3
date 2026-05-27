import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { StorageService } from "./storage.service";
import { ConfigService } from "@nestjs/config";

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
});
