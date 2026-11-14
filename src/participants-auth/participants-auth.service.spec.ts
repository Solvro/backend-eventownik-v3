import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { ParticipantsAuthService } from "./participants-auth.service";

describe("ParticipantsAuthService", () => {
  let service: ParticipantsAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ParticipantsAuthService],
    }).compile();

    service = module.get<ParticipantsAuthService>(ParticipantsAuthService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
