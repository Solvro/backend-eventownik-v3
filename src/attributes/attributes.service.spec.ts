import { Test, TestingModule } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";
import { AttributesService } from "./attributes.service";

describe("AttributesService", () => {
  let service: AttributesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AttributesService, PrismaService],
    }).compile();

    service = module.get<AttributesService>(AttributesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should call prisma.attribute.create on create", async () => {
    const dto = {
      eventUuid: "uuid-event",
      type: "TEXT",
      showInList: true,
      options: ["A", "B"],
      name: "Shirt size",
    };

    prisma.attribute.create = jest.fn().mockResolvedValue(dto);

    const result = await service.create(dto as any);

    expect(prisma.attribute.create).toHaveBeenCalledWith({ data: dto });
    expect(result).toEqual(dto);
  });
});
