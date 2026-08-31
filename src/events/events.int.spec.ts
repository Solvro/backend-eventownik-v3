import type { Admin, Event } from "src/generated/prisma/client";
import { OrganizerType, PermissionType } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { StorageService } from "src/storage/storage.service";

import { ConflictException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";

import { EventCreateDto } from "./dto/event-create.dto";
import { EventListingDto } from "./dto/event-listing.dto";
import { EventUpdateDto } from "./dto/event-update.dto";
import { EventsService } from "./events.service";

describe("EventsService (integration)", () => {
  let service: EventsService;
  let prisma: PrismaService;

  const createdAdminUuids: string[] = [];
  const createdEventUuids: string[] = [];
  const uploadedPhotoKeys: string[] = [];

  const mockStorageService = {
    getUrl: jest.fn(
      (bucket: string, key: string) => `https://cdn.test/${bucket}/${key}`,
    ),
    upload: jest.fn(),
    delete: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn(() => "events"),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        PrismaService,
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
  });

  afterAll(async () => {
    await prisma.eventPermission.deleteMany({
      where: {
        OR: [
          { eventUuid: { in: createdEventUuids } },
          { adminUuid: { in: createdAdminUuids } },
        ],
      },
    });
    await prisma.eventLink.deleteMany({
      where: { eventUuid: { in: createdEventUuids } },
    });
    await prisma.event.deleteMany({
      where: { uuid: { in: createdEventUuids } },
    });
    await prisma.admin.deleteMany({
      where: { uuid: { in: createdAdminUuids } },
    });

    await prisma.$disconnect();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  async function createAdmin(
    overrides: Partial<{
      email: string;
      type: OrganizerType;
      active: boolean;
    }> = {},
  ): Promise<Admin> {
    const admin = await prisma.admin.create({
      data: {
        firstName: "Test",
        lastName: "Admin",
        email: `${String(Date.now())}-${Math.random().toString(36).slice(2)}@events-int.local`,
        password: "$2b$10$placeholder.hash",
        type: OrganizerType.organizer,
        active: true,
        ...overrides,
      },
    });
    createdAdminUuids.push(admin.uuid);
    return admin;
  }

  async function createEvent(
    organizerUuid: string,
    overrides: Partial<{
      name: string;
      slug: string;
      startDate: Date;
      endDate: Date;
      isPublic: boolean;
      isVerified: boolean;
      isFeatured: boolean;
      photoKey: string | null;
    }> = {},
  ): Promise<Event> {
    const event = await prisma.event.create({
      data: {
        name: "Test Event",
        slug: `events-int-${String(Date.now())}-${Math.random().toString(36).slice(2)}`,
        startDate: new Date("2025-06-01"),
        endDate: new Date("2025-06-02"),
        organizerUuid,
        isPublic: false,
        isVerified: false,
        isFeatured: false,
        ...overrides,
      },
    });
    createdEventUuids.push(event.uuid);
    return event;
  }

  async function grantPermission(
    adminUuid: string,
    eventUuid: string,
    permission: PermissionType = PermissionType.MANAGE_EVENT,
  ): Promise<void> {
    await prisma.eventPermission.create({
      data: { adminUuid, eventUuid, permission },
    });
  }

  describe("create", () => {
    it("creates event with superadmin verification and featured flag", async () => {
      const admin = await createAdmin({ type: OrganizerType.superadmin });
      const dto = Object.assign(new EventCreateDto(), {
        name: "Verified Event",
        slug: `verified-${String(Date.now())}`,
        startDate: new Date("2025-07-01"),
        endDate: new Date("2025-07-02"),
        isPublic: true,
        isVerified: true,
        isFeatured: true,
      });

      const event = await service.create(
        dto,
        undefined,
        admin.uuid,
        OrganizerType.superadmin,
      );

      expect(event.name).toBe("Verified Event");
      expect(event.isVerified).toBe(true);
      expect(event.isFeatured).toBe(true);
      expect(event.verifiedAt).toBeInstanceOf(Date);

      const databaseEvent = await prisma.event.findUnique({
        where: { uuid: event.uuid },
      });
      expect(databaseEvent?.isVerified).toBe(true);
      expect(databaseEvent?.isFeatured).toBe(true);
      createdEventUuids.push(event.uuid);
    });

    it("ignores isVerified and isFeatured for organizer", async () => {
      const admin = await createAdmin({ type: OrganizerType.organizer });
      const dto = Object.assign(new EventCreateDto(), {
        name: "Organizer Event",
        slug: `org-${String(Date.now())}`,
        startDate: new Date("2025-07-01"),
        endDate: new Date("2025-07-02"),
        isVerified: true,
        isFeatured: true,
      });

      const event = await service.create(
        dto,
        undefined,
        admin.uuid,
        OrganizerType.organizer,
      );

      expect(event.isVerified).toBe(false);
      expect(event.isFeatured).toBe(false);
      expect(event.verifiedAt).toBeNull();
      createdEventUuids.push(event.uuid);
    });

    it("uploads photo and stores key", async () => {
      const admin = await createAdmin();
      const photo = {
        originalname: "test.jpg",
        buffer: Buffer.from("fake image data"),
        mimetype: "image/jpeg",
      } as Express.Multer.File;

      mockStorageService.upload.mockResolvedValue("uploaded-key-123.jpg");

      const dto = Object.assign(new EventCreateDto(), {
        name: "Photo Event",
        slug: `photo-${String(Date.now())}`,
        startDate: new Date("2025-07-01"),
        endDate: new Date("2025-07-02"),
      });

      const event = await service.create(
        dto,
        photo,
        admin.uuid,
        OrganizerType.organizer,
      );

      expect(mockStorageService.upload).toHaveBeenCalledWith("events", photo);
      expect(event.photoUrl).toBe(
        "https://cdn.test/events/uploaded-key-123.jpg",
      );

      const databaseEvent = await prisma.event.findUnique({
        where: { uuid: event.uuid },
      });
      expect(databaseEvent?.photoKey).toBe("uploaded-key-123.jpg");

      uploadedPhotoKeys.push("uploaded-key-123.jpg");
      createdEventUuids.push(event.uuid);
    });

    it("deletes uploaded photo on creation failure", async () => {
      const admin = await createAdmin();
      const photo = {
        originalname: "test.jpg",
        buffer: Buffer.from("fake"),
        mimetype: "image/jpeg",
      } as Express.Multer.File;

      mockStorageService.upload.mockResolvedValue("key-to-delete.jpg");

      const dto = Object.assign(new EventCreateDto(), {
        name: "Test",
        slug: "duplicate-slug-for-conflict",
        startDate: new Date("2025-07-01"),
        endDate: new Date("2025-07-02"),
      });

      await service.create(dto, undefined, admin.uuid, OrganizerType.organizer);

      mockStorageService.upload.mockResolvedValue("key-to-delete.jpg");
      await expect(
        service.create(dto, photo, admin.uuid, OrganizerType.organizer),
      ).rejects.toThrow(ConflictException);

      expect(mockStorageService.delete).toHaveBeenCalledWith(
        "events",
        "key-to-delete.jpg",
      );

      const event = await prisma.event.findFirst({
        where: { slug: "duplicate-slug-for-conflict" },
      });
      if (event !== null) {
        createdEventUuids.push(event.uuid);
      }
    });

    it("creates permission record for organizer", async () => {
      const admin = await createAdmin();
      const dto = Object.assign(new EventCreateDto(), {
        name: "Permission Test",
        slug: `perm-${String(Date.now())}`,
        startDate: new Date("2025-07-01"),
        endDate: new Date("2025-07-02"),
      });

      const event = await service.create(
        dto,
        undefined,
        admin.uuid,
        OrganizerType.organizer,
      );

      const perm = await prisma.eventPermission.findUnique({
        where: {
          eventUuid_adminUuid_permission: {
            eventUuid: event.uuid,
            adminUuid: admin.uuid,
            permission: "MANAGE_ALL",
          },
        },
      });
      expect(perm).toBeDefined();
      createdEventUuids.push(event.uuid);
    });
  });

  describe("update", () => {
    it("updates event fields", async () => {
      const admin = await createAdmin();
      const event = await createEvent(admin.uuid);
      await grantPermission(admin.uuid, event.uuid);

      const dto = Object.assign(new EventUpdateDto(), {
        name: "Updated Name",
        description: "New description",
      });

      const result = await service.update(
        event.uuid,
        dto,
        undefined,
        OrganizerType.organizer,
      );

      expect(result.name).toBe("Updated Name");
      expect(result.description).toBe("New description");

      const databaseEvent = await prisma.event.findUnique({
        where: { uuid: event.uuid },
      });
      expect(databaseEvent?.name).toBe("Updated Name");
    });

    it("replaces photo and deletes old one", async () => {
      const admin = await createAdmin();
      const event = await createEvent(admin.uuid, {
        photoKey: "old-photo.jpg",
      });

      const newPhoto = {
        originalname: "new.jpg",
        buffer: Buffer.from("new data"),
        mimetype: "image/jpeg",
      } as Express.Multer.File;

      mockStorageService.upload.mockResolvedValue("new-photo.jpg");

      const dto = new EventUpdateDto();
      const result = await service.update(
        event.uuid,
        dto,
        newPhoto,
        OrganizerType.organizer,
      );

      expect(mockStorageService.upload).toHaveBeenCalledWith(
        "events",
        newPhoto,
      );
      expect(mockStorageService.delete).toHaveBeenCalledWith(
        "events",
        "old-photo.jpg",
      );
      expect(result.photoUrl).toBe("https://cdn.test/events/new-photo.jpg");

      uploadedPhotoKeys.push("new-photo.jpg");
    });

    it("removes photo when photoUrl is null", async () => {
      const admin = await createAdmin();
      const event = await createEvent(admin.uuid, {
        photoKey: "to-remove.jpg",
      });

      const dto = Object.assign(new EventUpdateDto(), { photoUrl: null });
      const result = await service.update(
        event.uuid,
        dto,
        undefined,
        OrganizerType.organizer,
      );

      expect(mockStorageService.delete).toHaveBeenCalledWith(
        "events",
        "to-remove.jpg",
      );
      expect(result.photoUrl).toBeNull();

      const databaseEvent = await prisma.event.findUnique({
        where: { uuid: event.uuid },
      });
      expect(databaseEvent?.photoKey).toBeNull();
    });

    it("ignores isVerified and isFeatured for organizer", async () => {
      const admin = await createAdmin({ type: OrganizerType.organizer });
      const event = await createEvent(admin.uuid, {
        isVerified: false,
        isFeatured: false,
      });

      const dto = Object.assign(new EventUpdateDto(), {
        isVerified: true,
        isFeatured: true,
      });
      const result = await service.update(
        event.uuid,
        dto,
        undefined,
        OrganizerType.organizer,
      );

      expect(result.isVerified).toBe(false);
      expect(result.isFeatured).toBe(false);

      const databaseEvent = await prisma.event.findUnique({
        where: { uuid: event.uuid },
      });
      expect(databaseEvent?.isVerified).toBe(false);
      expect(databaseEvent?.isFeatured).toBe(false);
    });

    it("allows superadmin to set verification and featured flag", async () => {
      const admin = await createAdmin({ type: OrganizerType.superadmin });
      const event = await createEvent(admin.uuid, {
        isVerified: false,
        isFeatured: false,
      });

      const dto = Object.assign(new EventUpdateDto(), {
        isVerified: true,
        isFeatured: true,
      });
      const result = await service.update(
        event.uuid,
        dto,
        undefined,
        OrganizerType.superadmin,
      );

      expect(result.isVerified).toBe(true);
      expect(result.isFeatured).toBe(true);
      expect(result.verifiedAt).toBeInstanceOf(Date);
    });

    it("throws NotFoundException for missing event", async () => {
      const dto = new EventUpdateDto();
      await expect(
        service.update(
          "00000000-0000-0000-0000-000000000000",
          dto,
          undefined,
          OrganizerType.organizer,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("deletes event and associated photo", async () => {
      const admin = await createAdmin();
      const event = await createEvent(admin.uuid, {
        photoKey: "event-photo.jpg",
      });

      await service.remove(event.uuid);

      expect(mockStorageService.delete).toHaveBeenCalledWith(
        "events",
        "event-photo.jpg",
      );

      const databaseEvent = await prisma.event.findUnique({
        where: { uuid: event.uuid },
      });
      expect(databaseEvent).toBeNull();
    });

    it("deletes event without photo", async () => {
      const admin = await createAdmin();
      const event = await createEvent(admin.uuid);

      await service.remove(event.uuid);

      expect(mockStorageService.delete).not.toHaveBeenCalled();

      const databaseEvent = await prisma.event.findUnique({
        where: { uuid: event.uuid },
      });
      expect(databaseEvent).toBeNull();
    });

    it("throws NotFoundException for missing event", async () => {
      await expect(
        service.remove("00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("findOne", () => {
    it("returns event by uuid", async () => {
      const admin = await createAdmin();
      const event = await createEvent(admin.uuid);

      const result = await service.findOne(event.uuid);

      expect(result.uuid).toBe(event.uuid);
      expect(result.name).toBe("Test Event");
    });

    it("resolves photoKey to public url", async () => {
      const admin = await createAdmin();
      const event = await createEvent(admin.uuid, { photoKey: "my-photo.jpg" });

      const result = await service.findOne(event.uuid);

      expect(result.photoUrl).toBe("https://cdn.test/events/my-photo.jpg");
      expect(result).not.toHaveProperty("photoKey");
    });

    it("throws NotFoundException for missing event", async () => {
      await expect(
        service.findOne("00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("findAll", () => {
    it("returns organizer's events", async () => {
      const organizer = await createAdmin({ type: OrganizerType.organizer });
      const other = await createAdmin();
      const event1 = await createEvent(organizer.uuid);
      const event2 = await createEvent(other.uuid);
      await grantPermission(organizer.uuid, event2.uuid);

      const result = await service.findAll(
        new EventListingDto(),
        [event1.uuid, event2.uuid],
        OrganizerType.organizer,
      );

      expect(result.data).toHaveLength(2);
      const uuids = result.data.map((event) => event.uuid);
      expect(uuids).toContain(event1.uuid);
      expect(uuids).toContain(event2.uuid);
    });

    it("returns all events for superadmin", async () => {
      const admin1 = await createAdmin();
      const admin2 = await createAdmin();
      const event1 = await createEvent(admin1.uuid);
      const event2 = await createEvent(admin2.uuid);

      const result = await service.findAll(
        new EventListingDto(),
        [],
        OrganizerType.superadmin,
      );

      expect(result.data.length).toBeGreaterThanOrEqual(2);
      const uuids = result.data.map((event) => event.uuid);
      expect(uuids).toContain(event1.uuid);
      expect(uuids).toContain(event2.uuid);
    });

    it("filters by name", async () => {
      const admin = await createAdmin();
      const event1 = await createEvent(admin.uuid, { name: "Unique Name ABC" });
      const event2 = await createEvent(admin.uuid, { name: "Other Event" });

      const query = Object.assign(new EventListingDto(), {
        name: "Unique Name",
      });
      const result = await service.findAll(
        query,
        [event1.uuid, event2.uuid],
        OrganizerType.organizer,
      );

      const names = result.data.map((event) => event.name);
      expect(names).toContain("Unique Name ABC");
      expect(names).not.toContain("Other Event");
    });

    it("resolves all photoKeys to urls", async () => {
      const admin = await createAdmin();
      const event1 = await createEvent(admin.uuid, { photoKey: "photo1.jpg" });
      const event2 = await createEvent(admin.uuid);

      const result = await service.findAll(
        new EventListingDto(),
        [event1.uuid, event2.uuid],
        OrganizerType.organizer,
      );

      const photo1Event = result.data.find(
        (event) => event.uuid === event1.uuid,
      );
      expect(photo1Event?.photoUrl).toBe("https://cdn.test/events/photo1.jpg");

      const photo2Event = result.data.find(
        (event) => event.uuid === event2.uuid,
      );
      expect(photo2Event?.photoUrl).toBeNull();
    });
  });

  describe("findAllPublic", () => {
    it("returns only verified public events", async () => {
      const admin = await createAdmin();
      const publicVerified = await createEvent(admin.uuid, {
        isPublic: true,
        isVerified: true,
      });
      const publicUnverified = await createEvent(admin.uuid, {
        isPublic: true,
        isVerified: false,
      });
      const privateVerified = await createEvent(admin.uuid, {
        isPublic: false,
        isVerified: true,
      });

      const result = await service.findAllPublic(new EventListingDto());

      const uuids = result.data.map((event) => event.uuid);
      expect(uuids).toContain(publicVerified.uuid);
      expect(uuids).not.toContain(publicUnverified.uuid);
      expect(uuids).not.toContain(privateVerified.uuid);
    });

    it("resolves photoKeys to urls", async () => {
      const admin = await createAdmin();
      const event = await createEvent(admin.uuid, {
        isPublic: true,
        isVerified: true,
        photoKey: "public-photo.jpg",
      });

      const result = await service.findAllPublic(new EventListingDto());

      const found = result.data.find((event1) => event1.uuid === event.uuid);
      expect(found).toBeDefined();
      if (found == null) {
        return;
      }
      expect(found.photoUrl).toBe("https://cdn.test/events/public-photo.jpg");
    });
  });

  describe("findOnePublic", () => {
    it("returns any public event by slug", async () => {
      const admin = await createAdmin();
      const event = await createEvent(admin.uuid, {
        slug: "public-event-slug",
        isPublic: true,
        isVerified: false,
      });

      const result = await service.findOnePublic("public-event-slug");

      expect(result.uuid).toBe(event.uuid);
    });

    it("returns verified public event by slug", async () => {
      const admin = await createAdmin();
      const event = await createEvent(admin.uuid, {
        slug: "verified-public-slug",
        isPublic: true,
        isVerified: true,
      });

      const result = await service.findOnePublic("verified-public-slug");

      expect(result.uuid).toBe(event.uuid);
    });

    it("throws NotFoundException for private event", async () => {
      const admin = await createAdmin();
      await createEvent(admin.uuid, {
        slug: "private-slug",
        isPublic: false,
        isVerified: true,
      });

      await expect(service.findOnePublic("private-slug")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("resolves photoKey to url", async () => {
      const admin = await createAdmin();
      const _event = await createEvent(admin.uuid, {
        slug: "photo-public-slug",
        isPublic: true,
        photoKey: "public-event-photo.jpg",
      });

      const result = await service.findOnePublic("photo-public-slug");

      expect(result.photoUrl).toBe(
        "https://cdn.test/events/public-event-photo.jpg",
      );
    });
  });
});
