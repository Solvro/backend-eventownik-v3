import { ConflictException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { Prisma } from "../generated/prisma/client";
import { OrganizerType } from "../generated/prisma/enums";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { EventCreateDto } from "./dto/event-create.dto";
import type { EventListingDto } from "./dto/event-listing.dto";
import { EventUpdateDto } from "./dto/event-update.dto";
import { Event } from "./entities/event.entity";
import { EventsService } from "./events.service";

const BUCKET = "events-bucket";

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("mock prisma error", {
    code,
    clientVersion: "test",
  });
}

function createBaseDto(): EventCreateDto {
  return Object.assign(new EventCreateDto(), {
    name: "test",
    startDate: new Date(),
    endDate: new Date(),
    isVerified: true,
    slug: "xcscxzcxz123",
    isPublic: true,
    links: [],
  });
}

function updateBaseDto(): EventUpdateDto {
  return Object.assign(new EventUpdateDto(), {
    name: "updated test",
    startDate: new Date(),
    endDate: new Date(),
    isVerified: true,
    slug: "updated-xcscxzcxz123",
    isPublic: true,
  });
}

function dataArgument(mockFunction: unknown): Record<string, unknown> {
  const { calls } = (
    mockFunction as {
      mock: { calls: [{ data: Record<string, unknown> }][] };
    }
  ).mock;
  return calls[0][0].data;
}

describe("EventsService", () => {
  let service: EventsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    event: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    eventPermission: {
      create: jest.fn(),
    },
    eventLink: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockStorageService = {
    getUrl: jest.fn(
      (bucket: string, key: string) => `https://cdn.test/${bucket}/${key}`,
    ),
    upload: jest.fn(),
    delete: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn(() => BUCKET),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
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
      const mockAdmin = {
        id: 1,
        type: OrganizerType.organizer,
        eventsIds: ["1"],
      };

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

      expect(mockPrismaService.event.findMany).toHaveBeenCalledWith({
        where: { uuid: { in: mockAdmin.eventsIds } },
        skip: 0,
        take: 10,
        orderBy: [{ createdAt: "desc" }],
        include: { links: true },
      });
      expect(result.data).toEqual(
        mockEvents.map((event) => ({ ...event, photoUrl: null })),
      );
      expect(result.meta.itemCount).toBe(mockCount);
    });

    it("should not filter by uuid for superadmin", async () => {
      const query = {
        page: 1,
        take: 10,
        skip: 0,
      } as unknown as EventListingDto;

      (prisma.$transaction as jest.Mock).mockResolvedValue([0, []]);

      await service.findAll(query, ["1"], OrganizerType.superadmin);

      expect(mockPrismaService.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
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

      await service.findAll(query, ["1"], OrganizerType.organizer);

      const expectedWhere = {
        uuid: { in: ["1"] },
        name: { contains: "Meeting", mode: "insensitive" },
        location: { contains: "Room A", mode: "insensitive" },
      };

      expect(mockPrismaService.event.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });

      expect(mockPrismaService.event.findMany).toHaveBeenCalledWith(
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

      await service.findAll(query, ["1"], OrganizerType.organizer);

      expect(mockPrismaService.event.findMany).toHaveBeenCalledWith(
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
        isVerified: true,
        isPublic: true,
      };

      expect(mockPrismaService.event.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });

      expect(mockPrismaService.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhere,
          skip: 0,
          take: 10,
          orderBy: [{ createdAt: "desc" }],
          include: { links: true },
        }),
      );
      expect(result.data).toEqual(
        mockEvents.map((event) => ({ ...event, photoUrl: null })),
      );
      expect(result.meta.itemCount).toBe(mockCount);
    });
  });

  describe("findOne", () => {
    it("should return event by UUID", async () => {
      const eventId = "123e4567-e89b-12d3-a456-426614174000";
      const mockEvent = { uuid: eventId, name: "Test Event", photoKey: null };

      (prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent);

      const result = await service.findOne(eventId);
      expect(result).toEqual({
        uuid: eventId,
        name: "Test Event",
        photoUrl: null,
      });

      expect(mockPrismaService.event.findUnique).toHaveBeenCalledWith({
        where: { uuid: eventId },
        include: { links: true },
      });
    });

    it("should resolve photoKey to a public photoUrl", async () => {
      const eventId = "123e4567-e89b-12d3-a456-426614174000";
      const mockEvent = {
        uuid: eventId,
        name: "Test Event",
        photoKey: "photo-123.png",
      };

      (prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent);

      const result = await service.findOne(eventId);

      expect(mockStorageService.getUrl).toHaveBeenCalledWith(
        BUCKET,
        "photo-123.png",
      );
      expect(result.photoUrl).toBe(`https://cdn.test/${BUCKET}/photo-123.png`);
      expect(result).not.toHaveProperty("photoKey");
    });

    it("Should throw NotFoundException if event does not exist", async () => {
      const eventId = "123e4567-e89b-12d3-a456-426614174000";

      (prisma.event.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne(eventId)).rejects.toThrow(
        `Event with UUID ${eventId} not found`,
      );

      expect(mockPrismaService.event.findUnique).toHaveBeenCalledWith({
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
        photoKey: null,
      };

      (prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent);

      const result = await service.findOnePublic(mockEvent.slug);
      expect(result).toEqual({
        uuid: eventId,
        name: "Test Event",
        isPublic: true,
        isVerified: true,
        slug: "elo-zelo",
        photoUrl: null,
      });

      expect(mockPrismaService.event.findUnique).toHaveBeenCalledWith({
        where: {
          slug: mockEvent.slug,
          isPublic: true,
        },
        include: {
          links: true,
          registerForm: {
            include: {
              formDefinitions: true,
            },
          },
        },
      });
    });

    it("Should throw NotFoundException if public event does not exist", async () => {
      const slug = "elo-zelo";

      (prisma.event.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOnePublic(slug)).rejects.toThrow(
        `Event with slug ${slug} not found`,
      );

      expect(mockPrismaService.event.findUnique).toHaveBeenCalledWith({
        where: {
          slug,
          isPublic: true,
        },
        include: {
          links: true,
          registerForm: {
            include: {
              formDefinitions: true,
            },
          },
        },
      });
    });
  });

  describe("create", () => {
    beforeEach(() => {
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) =>
          callback(mockPrismaService),
      );
      (prisma.eventPermission.create as jest.Mock).mockResolvedValue({});
    });

    it("should create event and return it", async () => {
      const eventDto = createBaseDto();
      const createdEvent = Object.assign(new Event(), eventDto, {
        uuid: "123e4567-e89b-12d3-a456-426614174000",
        photoKey: null,
      });

      (prisma.event.create as jest.Mock).mockResolvedValue(createdEvent);

      const result = await service.create(
        eventDto,
        undefined,
        "admin-uuid",
        OrganizerType.superadmin,
      );

      const createData = dataArgument(mockPrismaService.event.create);
      expect(createData.isVerified).toBe(true);
      expect(createData.verifiedAt).toBeInstanceOf(Date);
      expect(createData.photoKey).toBeNull();
      expect(mockPrismaService.eventPermission.create).toHaveBeenCalled();

      const { photoKey: _photoKey, ...createdWithoutKey } = createdEvent;
      expect(result).toEqual({ ...createdWithoutKey, photoUrl: null });
    });

    it("should ignore isVerified if admin type is organizer", async () => {
      const eventDto = createBaseDto();
      const createdEvent = Object.assign(new Event(), eventDto, {
        uuid: "123e4567-e89b-12d3-a456-426614174000",
        isVerified: false,
        verifiedAt: null,
        photoKey: null,
      });

      (prisma.event.create as jest.Mock).mockResolvedValue(createdEvent);

      await service.create(
        eventDto,
        undefined,
        "admin-uuid",
        OrganizerType.organizer,
      );

      const createData = dataArgument(mockPrismaService.event.create);
      expect(createData.isVerified).toBeUndefined();
      expect(createData.verifiedAt).toBeUndefined();
    });

    it("should upload photo and store its key", async () => {
      const eventDto = createBaseDto();
      const photo = { originalname: "photo.png" } as Express.Multer.File;
      const createdEvent = Object.assign(new Event(), eventDto, {
        uuid: "123e4567-e89b-12d3-a456-426614174000",
        photoKey: "uploaded-key.png",
      });

      mockStorageService.upload.mockResolvedValue("uploaded-key.png");
      (prisma.event.create as jest.Mock).mockResolvedValue(createdEvent);

      const result = await service.create(
        eventDto,
        photo,
        "admin-uuid",
        OrganizerType.superadmin,
      );

      expect(mockStorageService.upload).toHaveBeenCalledWith(BUCKET, photo);
      expect(dataArgument(mockPrismaService.event.create).photoKey).toBe(
        "uploaded-key.png",
      );
      expect(result.photoUrl).toBe(
        `https://cdn.test/${BUCKET}/uploaded-key.png`,
      );
    });

    it("should delete uploaded photo if creation fails", async () => {
      const eventDto = createBaseDto();
      const photo = { originalname: "photo.png" } as Express.Multer.File;

      mockStorageService.upload.mockResolvedValue("uploaded-key.png");
      (prisma.event.create as jest.Mock).mockRejectedValue(
        new Error("db down"),
      );

      await expect(
        service.create(eventDto, photo, "admin-uuid", OrganizerType.superadmin),
      ).rejects.toThrow("db down");

      expect(mockStorageService.delete).toHaveBeenCalledWith(
        BUCKET,
        "uploaded-key.png",
      );
    });

    it("should throw confilct error if slug is already taken", async () => {
      const eventDto = createBaseDto();
      eventDto.slug = "existing-slug";

      (prisma.event.create as jest.Mock).mockRejectedValue(
        prismaError("P2002"),
      );

      await expect(
        service.create(
          eventDto,
          undefined,
          "admin-uuid",
          OrganizerType.superadmin,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("update", () => {
    const eventUuid = "123e4567-e89b-12d3-a456-426614174000";

    it("should update event and return it", async () => {
      const eventDto = updateBaseDto();
      const updatedEvent = Object.assign(new Event(), eventDto, {
        uuid: eventUuid,
        photoKey: null,
      });

      (prisma.event.update as jest.Mock).mockResolvedValue(updatedEvent);

      const result = await service.update(
        eventUuid,
        eventDto,
        undefined,
        OrganizerType.superadmin,
      );

      const { photoKey: _photoKey, ...updatedWithoutKey } = updatedEvent;
      expect(result).toEqual({ ...updatedWithoutKey, photoUrl: null });
    });

    it("should replace photo and delete the previous one", async () => {
      const eventDto = new EventUpdateDto();
      const photo = { originalname: "new.png" } as Express.Multer.File;
      const updatedEvent = {
        uuid: eventUuid,
        name: "test",
        photoKey: "new-key.png",
      };

      (prisma.event.findUnique as jest.Mock).mockResolvedValue({
        uuid: eventUuid,
        photoKey: "old-key.png",
      });
      mockStorageService.upload.mockResolvedValue("new-key.png");
      (prisma.event.update as jest.Mock).mockResolvedValue(updatedEvent);

      const result = await service.update(
        eventUuid,
        eventDto,
        photo,
        OrganizerType.superadmin,
      );

      expect(dataArgument(mockPrismaService.event.update).photoKey).toBe(
        "new-key.png",
      );
      expect(mockStorageService.delete).toHaveBeenCalledWith(
        BUCKET,
        "old-key.png",
      );
      expect(result.photoUrl).toBe(`https://cdn.test/${BUCKET}/new-key.png`);
    });

    it("should remove photo when photoUrl is null", async () => {
      const eventDto = Object.assign(new EventUpdateDto(), { photoUrl: null });
      const updatedEvent = { uuid: eventUuid, name: "test", photoKey: null };

      (prisma.event.findUnique as jest.Mock).mockResolvedValue({
        uuid: eventUuid,
        photoKey: "old-key.png",
      });
      (prisma.event.update as jest.Mock).mockResolvedValue(updatedEvent);

      const result = await service.update(
        eventUuid,
        eventDto,
        undefined,
        OrganizerType.superadmin,
      );

      expect(dataArgument(mockPrismaService.event.update).photoKey).toBeNull();
      expect(mockStorageService.delete).toHaveBeenCalledWith(
        BUCKET,
        "old-key.png",
      );
      expect(mockStorageService.upload).not.toHaveBeenCalled();
      expect(result.photoUrl).toBeNull();
    });

    it("should ignore isVerified if admin type is organizer", async () => {
      const eventDto = updateBaseDto();
      const updatedEvent = { uuid: eventUuid, name: "test", photoKey: null };

      (prisma.event.update as jest.Mock).mockResolvedValue(updatedEvent);

      await service.update(
        eventUuid,
        eventDto,
        undefined,
        OrganizerType.organizer,
      );

      const updateData = dataArgument(mockPrismaService.event.update);
      expect(updateData.isVerified).toBeUndefined();
      expect(updateData.verifiedAt).toBeUndefined();
    });

    it("should throw NotFoundException if event does not exist", async () => {
      const eventDto = updateBaseDto();

      (prisma.event.update as jest.Mock).mockRejectedValue(
        prismaError("P2025"),
      );

      await expect(
        service.update(
          eventUuid,
          eventDto,
          undefined,
          OrganizerType.superadmin,
        ),
      ).rejects.toThrow(`Event with UUID ${eventUuid} not found`);
    });
  });

  describe("remove", () => {
    const eventUuid = "123e4567-e89b-12d3-a456-426614174000";

    it("should delete event and return no content", async () => {
      (prisma.event.delete as jest.Mock).mockResolvedValue({
        uuid: eventUuid,
        photoKey: null,
      });

      await expect(service.remove(eventUuid)).resolves.toBeUndefined();
      expect(mockStorageService.delete).not.toHaveBeenCalled();
    });

    it("should delete stored photo along with the event", async () => {
      (prisma.event.delete as jest.Mock).mockResolvedValue({
        uuid: eventUuid,
        photoKey: "photo-key.png",
      });

      await service.remove(eventUuid);

      expect(mockStorageService.delete).toHaveBeenCalledWith(
        BUCKET,
        "photo-key.png",
      );
    });

    it("should throw NotFoundException if event does not exist", async () => {
      (prisma.event.delete as jest.Mock).mockRejectedValue(
        prismaError("P2025"),
      );

      await expect(service.remove(eventUuid)).rejects.toThrow(
        `Event with UUID ${eventUuid} not found`,
      );
    });
  });
});
