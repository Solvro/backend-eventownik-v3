import { ConflictException, NotFoundException } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";
import { EventCreateDto } from "./dto/event-create.dto";
import type { EventListingDto } from "./dto/event-listing.dto";
import { EventUpdateDto } from "./dto/event-update.dto";
import { Event } from "./entities/event.entity";
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
    jest.clearAllMocks();
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
      const mockAdmin = { id: 1, type: "organizer", eventsIds: ["1"] };

      (prisma.event.count as jest.Mock).mockReturnValue("countQuery");
      (prisma.event.findMany as jest.Mock).mockReturnValue("findManyQuery");
      (prisma.$transaction as jest.Mock).mockResolvedValue([
        mockCount,
        mockEvents,
      ]);

      const result = await service.findAll(
        query,
        mockAdmin.eventsIds,
        mockAdmin.type,
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.event.findMany).toHaveBeenCalledWith({
        where: { uuid: { in: mockAdmin.eventsIds } },
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

      await service.findAll(query, ["1"], "organizer");

      const expectedWhere = {
        uuid: { in: ["1"] },
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

      await service.findAll(query, ["1"], "organizer");

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
        isVerified: true,
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
    });
  });

  describe("findOne", () => {
    it("should return event by UUID", async () => {
      const eventId = "123e4567-e89b-12d3-a456-426614174000";
      const mockEvent = { uuid: eventId, name: "Test Event" };

      (prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent);

      const result = await service.findOne(eventId);
      expect(result).toBe(mockEvent);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.event.findUnique).toHaveBeenCalledWith({
        where: { uuid: eventId },
        include: { links: true },
      });
    });

    it("Should throw NotFoundException if event does not exist", async () => {
      const eventId = "123e4567-e89b-12d3-a456-426614174000";

      (prisma.event.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne(eventId)).rejects.toThrow(
        `Event with UUID ${eventId} not found`,
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.event.findUnique).toHaveBeenCalledWith({
        where: { uuid: eventId },
        include: { links: true },
      });
    });
  });

  describe("findOnePublic", () => {
    it("should return public event by Slug", async () => {
      const eventId = "123e4567-e89b-12d3-a456-426614174000";
      const mockEvent = {
        uuid: eventId,
        name: "Test Event",
        isPublic: true,
        isVerified: true,
        slug: "elo-zelo",
      };

      (prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent);

      const result = await service.findOnePublic(mockEvent.slug);
      expect(result).toBe(mockEvent);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.event.findUnique).toHaveBeenCalledWith({
        where: {
          slug: mockEvent.slug,
          isVerified: true,
          isPublic: true,
        },
        include: { links: true },
      });
    });

    it("Should throw NotFoundException if public event does not exist", async () => {
      const slug = "elo-zelo";

      (prisma.event.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOnePublic(slug)).rejects.toThrow(
        `Event with slug ${slug} not found`,
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.event.findUnique).toHaveBeenCalledWith({
        where: {
          slug,
          isVerified: true,
          isPublic: true,
        },
        include: { links: true },
      });
    });
  });

  describe("create", () => {
    it("should create event and return it", async () => {
      const eventDto = Object.assign(new EventCreateDto(), {
        name: "test",
        startDate: new Date(),
        endDate: new Date(),
        createdAt: "2026-03-07T13:23:09.228Z",
        updatedAt: "2026-03-07T13:23:09.228Z",
        isVerified: true,
        slug: "xcscxzcxz123",
        isPublic: true,
        links: [],
      });

      const mockAdmin = { uuid: "", type: "superadmin" };
      const createdEvent = Object.assign(new Event(), eventDto, {
        uuid: "123e4567-e89b-12d3-a456-426614174000",
      });

      (prisma.event.create as jest.Mock).mockResolvedValue(createdEvent);
      (prisma.$transaction as jest.Mock).mockResolvedValue(createdEvent);

      const result = await service.create(eventDto, null, mockAdmin.uuid);

      expect(result).toBe(createdEvent);
    });
    //TODO: to raczej do testów kontrolera
    it("should change isVerified to false if admin type is organizer", async () => {
      const eventDto = Object.assign(new EventCreateDto(), {
        name: "test",
        startDate: new Date(),
        endDate: new Date(),
        createdAt: "2026-03-07T13:23:09.228Z",
        updatedAt: "2026-03-07T13:23:09.228Z",
        isVerified: true,
        slug: "xcscxzcxz123",
        isPublic: true,
        links: [],
      });

      const mockAdmin = { uuid: "", type: "organizer" };
      const createdEvent = Object.assign(new Event(), eventDto, {
        uuid: "123e4567-e89b-12d3-a456-426614174000",
        isVerified: false,
        verifiedAt: null,
      });

      (prisma.event.create as jest.Mock).mockResolvedValue(createdEvent);
      (prisma.$transaction as jest.Mock).mockResolvedValue(createdEvent);

      const result = await service.create(eventDto, null, mockAdmin.uuid);

      expect(result).toBe(createdEvent);
    });
    it("should throw confilct error if slug is already taken", async () => {
      const eventDto = Object.assign(new EventCreateDto(), {
        name: "test",
        startDate: new Date(),
        endDate: new Date(),
        createdAt: "2026-03-07T13:23:09.228Z",
        updatedAt: "2026-03-07T13:23:09.228Z",
        isVerified: true,
        slug: "existing-slug",
        isPublic: true,
        links: [],
      });

      const prismaError = new ConflictException(
        `Event with slug ${eventDto.slug} already exists`,
      );

      (prisma.event.create as jest.Mock).mockRejectedValue(prismaError);
      (prisma.$transaction as jest.Mock).mockRejectedValue(prismaError);

      await expect(
        service.create(eventDto, null, "admin-uuid"),
      ).rejects.toThrow(`Event with slug ${eventDto.slug} already exists`);
    });
  });

  describe("update", () => {
    it("should update event and return it", async () => {
      const eventDto = Object.assign(new EventUpdateDto(), {
        uuid: "123e4567-e89b-12d3-a456-426614174000",
        name: "updated test",
        startDate: new Date(),
        endDate: new Date(),
        updatedAt: "2026-03-07T13:23:09.228Z",
        isVerified: true,
        slug: "updated-xcscxzcxz123",
        isPublic: true,
        links: [],
      });

      const updatedEvent = Object.assign(new Event(), eventDto, {
        uuid: "123e4567-e89b-12d3-a456-426614174000",
      });

      (prisma.event.update as jest.Mock).mockResolvedValue(updatedEvent);
      (prisma.$transaction as jest.Mock).mockResolvedValue(updatedEvent);

      const result = await service.update(eventDto.uuid, eventDto, null);

      expect(result).toBe(updatedEvent);
    });

    it("should throw NotFoundException if event does not exist", async () => {
      const eventDto = Object.assign(new EventUpdateDto(), {
        uuid: "123e4567-e89b-12d3-a456-426614174000",
        name: "updated test",
        startDate: new Date(),
        endDate: new Date(),
        updatedAt: "2026-03-07T13:23:09.228Z",
        isVerified: true,
        slug: "updated-xcscxzcxz123",
        isPublic: true,
        links: [],
      });

      const error = new NotFoundException(
        `Event with UUID ${eventDto.uuid} not found`,
      );

      (prisma.event.update as jest.Mock).mockRejectedValue(error);
      (prisma.$transaction as jest.Mock).mockRejectedValue(error);

      await expect(
        service.update(eventDto.uuid, eventDto, null),
      ).rejects.toThrow(`Event with UUID ${eventDto.uuid} not found`);
    });
  });

  describe("remove", () => {
    it("should delete event and return no content", async () => {
      (prisma.event.findFirst as jest.Mock).mockResolvedValue({
        uuid: "123e4567-e89b-12d3-a456-426614174000",
      });
      (prisma.event.delete as jest.Mock).mockResolvedValue({});

      const result = await service.remove(
        "123e4567-e89b-12d3-a456-426614174000",
      );

      expect(result).toEqual({});
    });

    it("should throw NotFoundException if event does not exist", async () => {
      const error = new NotFoundException(
        `Event with UUID 123e4567-e89b-12d3-a456-426614174000 not found`,
      );

      (prisma.event.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.event.delete as jest.Mock).mockRejectedValue(error);

      await expect(
        service.remove("123e4567-e89b-12d3-a456-426614174000"),
      ).rejects.toThrow(
        `Event with UUID 123e4567-e89b-12d3-a456-426614174000 not found`,
      );
    });
  });
});
