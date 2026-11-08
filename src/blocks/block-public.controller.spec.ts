import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";

import { BlocksPublicController } from "./block-public.controller";
import { BlocksService } from "./blocks.service";

describe("BlockPublicController", () => {
  let controller: BlocksPublicController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlocksPublicController],
      providers: [
        {
          provide: BlocksService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<BlocksPublicController>(BlocksPublicController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
