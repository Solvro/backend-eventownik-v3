import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { ParticipantsAuthController } from "./participants-auth.controller";

describe("ParticipantsAuthController", () => {
  let controller: ParticipantsAuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParticipantsAuthController],
    }).compile();

    controller = module.get<ParticipantsAuthController>(
      ParticipantsAuthController,
    );
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
