import { Test, TestingModule } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";
import { EventListingDto } from "./dto/event-listing.dto";
import { EventsService } from "./events.service";

describe("EventsService", () => {
  let service: EventsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    event: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("findAll", () => {
    it("should return paginated events with default sort", async () => {
      const query: EventListingDto = {
        page: 1,
        take: 10,
        skip: 0,
      } as any;

      const mockCount = 1;
      const mockEvents = [{ id: 1, name: "Test Event", createdAt: new Date() }];

      (prisma.event.count as jest.Mock).mockReturnValue("countQuery");
      (prisma.event.findMany as jest.Mock).mockReturnValue("findManyQuery");
      (prisma.$transaction as jest.Mock).mockResolvedValue([
        mockCount,
        mockEvents,
      ]);

      const result = await service.findAll(query);

      expect(prisma.event.count).toHaveBeenCalledWith({ where: {} });
      expect(prisma.event.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: [{ createdAt: "desc" }],
      });
      expect(result.data).toEqual(mockEvents);
      expect(result.meta.itemCount).toBe(mockCount);
    });

    it("should filter by name and location", async () => {
      const query: EventListingDto = {
        page: 1,
        take: 10,
        skip: 0,
        name: "Meeting",
        location: "Room A",
      } as any;

      const mockCount = 0;
      const mockEvents = [];

      (prisma.$transaction as jest.Mock).mockResolvedValue([
        mockCount,
        mockEvents,
      ]);

      await service.findAll(query);

      const expectedWhere = {
        name: { contains: "Meeting", mode: "insensitive" },
        location: { contains: "Room A", mode: "insensitive" },
      };

      expect(prisma.event.count).toHaveBeenCalledWith({ where: expectedWhere });
      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhere,
        }),
      );
    });

    it("should sort by provided field", async () => {
      const query: EventListingDto = {
        page: 1,
        take: 10,
        skip: 0,
        sort: "name:asc",
      } as any;

      const mockCount = 0;
      const mockEvents = [];

      (prisma.$transaction as jest.Mock).mockResolvedValue([
        mockCount,
        mockEvents,
      ]);

      await service.findAll(query);

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ name: "asc" }],
        }),
      );
    });
  });
});
