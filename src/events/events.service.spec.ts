import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";
import type { EventListingDto } from "./dto/event-listing.dto";
import { EventsService } from "./events.service";

describe("EventsService", () => {
  let service: EventsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    event: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    admin: {
      findFirst: jest.fn(),
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
      const query = {
        page: 1,
        take: 10,
        skip: 0,
      } as unknown as EventListingDto;

      const mockCount = 1;
      const mockEvents = [{ id: 1, name: "Test Event", createdAt: new Date() }];

      (prisma.event.count as jest.Mock).mockReturnValue("countQuery");
      (prisma.event.findMany as jest.Mock).mockReturnValue("findManyQuery");
      (prisma.$transaction as jest.Mock).mockResolvedValue([
        mockCount,
        mockEvents,
      ]);

      const result = await service.findAll(query);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.event.count).toHaveBeenCalledWith({ where: {} });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.event.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: [{ createdAt: "desc" }],
        include: { links: true },
      });
      expect(result.data).toEqual(mockEvents);
      expect(result.meta.itemCount).toBe(mockCount);
    });

    it("should filter by name and location", async () => {
      const query = {
        page: 1,
        take: 10,
        skip: 0,
        name: "Meeting",
        location: "Room A",
      } as unknown as EventListingDto;

      const mockCount = 0;
      const mockEvents: unknown[] = [];

      (prisma.$transaction as jest.Mock).mockResolvedValue([
        mockCount,
        mockEvents,
      ]);

      await service.findAll(query);

      const expectedWhere = {
        name: { contains: "Meeting", mode: "insensitive" },
        location: { contains: "Room A", mode: "insensitive" },
      };

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.event.count).toHaveBeenCalledWith({ where: expectedWhere });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhere,
        }),
      );
    });

    it("should sort by provided field", async () => {
      const query = {
        page: 1,
        take: 10,
        skip: 0,
        sort: "name:asc",
      } as unknown as EventListingDto;

      const mockCount = 0;
      const mockEvents: unknown[] = [];

      (prisma.$transaction as jest.Mock).mockResolvedValue([
        mockCount,
        mockEvents,
      ]);

      await service.findAll(query);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ name: "asc" }],
        }),
      );
    });
    // TODO: więcej testów filtrów i sortowania, testy permisji
  });

  describe("findAllPublic", () => {
    it("should return paginated public of only verified events with default sort", async () => {
      const query = {
        page: 1,
        take: 10,
        skip: 0,
      } as unknown as EventListingDto;

      const verifiedEvent = {
        id: 1,
        name: "Verified Event",
        verifiedAt: new Date(),
      };
      const unverifiedEvent = { id: 2, name: "Hidden Event", verifiedAt: null };

      const mockCount = 1;
      const mockEvents = [verifiedEvent];

      (prisma.event.count as jest.Mock).mockReturnValue("countQuery");
      (prisma.event.findMany as jest.Mock).mockReturnValue("findManyQuery");
      (prisma.$transaction as jest.Mock).mockResolvedValue([
        mockCount,
        mockEvents,
      ]);

      const result = await service.findAllPublic(query);

      const expectedWhere = {
        // TODO: is_public = true and verifiedAt not null
        verifiedAt: { not: null },
        isPublic: true,
      };

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.event.count).toHaveBeenCalledWith({ where: expectedWhere });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhere,
          skip: 0,
          take: 10,
          orderBy: [{ createdAt: "desc" }],
          include: { links: true },
        }),
      );
      expect(result.data).toEqual(mockEvents);
      expect(result.meta.itemCount).toBe(mockCount);
      expect(result.data).not.toContain(unverifiedEvent);
    });
  });

  describe("find one", () => {
    it("should throw NotFoundException if event does not exist", async () => {
      const uuid = "non-existent-uuid";

      (prisma.event.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne(uuid)).rejects.toThrow(
        `Event with UUID ${uuid} not found`,
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.event.findUnique).toHaveBeenCalledWith({
        where: { uuid },
        include: { links: true },
      });
    });
    it("should return the event if it exists", async () => {
      const uuid = "existing-uuid";
      const mockEvent = { id: 1, uuid, name: "Existing Event" };

      (prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent);

      const result = await service.findOne(uuid);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.event.findUnique).toHaveBeenCalledWith({
        where: { uuid },
        include: { links: true },
      });
      expect(result).toEqual(mockEvent);
    });
    // TODO: testy permisji
  });

  describe("find one public", () => {
    it("should throw NotFoundException if event does not exist", async () => {
      const slug = "non-existent-slug";

      (prisma.event.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOnePublic(slug)).rejects.toThrow(
        `Event with slug ${slug} not found`,
      );
    });

    it("should throw NotFoundException if event is not verified", async () => {
      const slug = "unverified-slug";
      (prisma.event.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOnePublic(slug)).rejects.toThrow(
        `Event with slug ${slug} not found`,
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.event.findUnique).toHaveBeenCalledWith({
        where: {
          slug,
          isPublic: true,
          verifiedAt: { not: null },
        },
        include: { links: true },
      });
    });
    it("should return the event if it exists and is verified", async () => {
      const slug = "verified-slug";
      const mockEvent = {
        id: 1,
        slug,
        name: "Verified Event",
        verifiedAt: new Date(),
        isPublic: true,
      };

      (prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent);

      const result = await service.findOnePublic(slug);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.event.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            slug,
            verifiedAt: { not: null },
            isPublic: true,
          },
          include: { links: true },
        }),
      );
      expect(result).toEqual(mockEvent);
    });
  });

  describe("create", () => {
    // TODO: dodać testy dla zdjęć
    it("should create and return the new event", async () => {
      const createDto = {
        name: "New Event",
        startDate: new Date(),
        endDate: new Date(),
        slug: "new-event",
        isPublic: true,
      };

      const mockCreatedEvent = { uuid: "MOCK-UUID", ...createDto };

      (prisma.event.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.event.create as jest.Mock).mockResolvedValue(mockCreatedEvent);

      const result = await service.create(createDto, null);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            ...createDto,
            photoUrl: null,
            // TODO: jak będzie auth to mozna odkomentować
            // organizerAdmin: {
            //   connect: { uuid: temporaryAdminUUID },
            // },
            links: { create: undefined },
          },
          include: { links: true },
        }),
      );
      expect(result).toEqual(mockCreatedEvent);
    });

    it("should throw ConflictException if event with the same slug exists", async () => {
      const createDto = {
        name: "New Event",
        startDate: new Date(),
        endDate: new Date(),
        slug: "existing-slug",
        isPublic: true,
      };

      const mockAdmin = { uuid: "some-admin-uuid" };
      const mockExistingEvent = { uuid: "existing-event-uuid" };

      (prisma.admin.findFirst as jest.Mock).mockResolvedValue(mockAdmin);
      (prisma.event.findUnique as jest.Mock).mockResolvedValue(
        mockExistingEvent,
      );

      await expect(service.create(createDto, null)).rejects.toThrow(
        `Event with slug ${createDto.slug} already exists`,
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.event.create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should throw NotFoundException if event does not exist", async () => {
      const uuid = "non-existent-uuid";
      const updateDto = { name: "Updated Event Name" };

      (prisma.event.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.update(uuid, updateDto, null)).rejects.toThrow(
        `Event with UUID ${uuid} not found`,
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.event.update).not.toHaveBeenCalled();
    });

    it("should update and return the event", async () => {
      const uuid = "existing-uuid";
      const updateDto = { name: "Updated Event Name" };
      const mockExistingEvent = {
        id: 1,
        uuid,
        name: "Old Event Name",
        slug: "old-event-slug",
      };
      const mockUpdatedEvent = {
        id: 1,
        uuid,
        name: "Updated Event Name",
        slug: "old-event-slug",
      };

      (prisma.event.findUnique as jest.Mock).mockResolvedValue(
        mockExistingEvent,
      );
      (prisma.event.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.event.update as jest.Mock).mockResolvedValue(mockUpdatedEvent);

      const result = await service.update(uuid, updateDto, null);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid },
          data: {
            ...updateDto,
            photoUrl: null,
            links: {
              deleteMany: {},
              create: undefined,
            },
          },
          include: { links: true },
        }),
      );
      expect(result).toEqual(mockUpdatedEvent);
    });

    // TODO: testy permisji
  });

  describe("remove", () => {
    it("should throw NotFoundException if event does not exist", async () => {
      const uuid = "non-existent-uuid";

      (prisma.event.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.remove(uuid)).rejects.toThrow(
        `Event with UUID ${uuid} not found`,
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.event.delete).not.toHaveBeenCalled();
    });

    it("should delete and return no content for existing event", async () => {
      const uuid = "existing-uuid";
      const mockEvent = { id: 1, uuid, name: "Event to be deleted" };

      (prisma.event.findFirst as jest.Mock).mockResolvedValue(mockEvent);

      const result = await service.remove(uuid);
      expect(result).toEqual(undefined);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.event.delete).toHaveBeenCalledWith({
        where: { uuid },
      });
    });
  });
});
