import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";
import { AttributesController } from "./attributes.controller";
import { AttributesService } from "./attributes.service";

describe("AttributesController", () => {
  let controller: AttributesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttributesController],
      providers: [AttributesService, PrismaService],
    }).compile();

    controller = module.get<AttributesController>(AttributesController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
