import { ParticipantsService } from "src/participants/participants.service";
import { PrismaService } from "src/prisma/prisma.service";

import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { BlocksService } from "./blocks.service";

describe("BlocksService", () => {
  let service: BlocksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlocksService,
        {
          provide: ParticipantsService,
          useValue: {},
        },
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<BlocksService>(BlocksService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
