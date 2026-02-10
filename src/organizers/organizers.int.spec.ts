import { PrismaService } from "src/prisma/prisma.service";

import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";

import { OrganizerListingDto } from "./dto/organizer-listing.dto";
import { OrganizersController } from "./organizers.controller";
import { OrganizersService } from "./organizers.service";

describe("Organizers integration tests", () => {
  let organizersController: OrganizersController;

  const mockPrismaService = {
    admin: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
    adminPermission: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
      controllers: [OrganizersController],
    }).compile();
    organizersController =
      module.get<OrganizersController>(OrganizersController);
  });
  it("should be defined", () => {
    expect(organizersController).toBeDefined();
  });
  describe("find all organizers by event", () => {
    it("should return a list of organizers", async () => {
      const eventUuid = "test-event-123";
      const query = new OrganizerListingDto();
      const mockOrganizers = [
        { firstName: "testName1", active: true },
        { firstName: "testName2", active: false },
      ];

      mockPrismaService.admin.findMany.mockResolvedValue(mockOrganizers);
      mockPrismaService.event.findUnique.mockResolvedValue("event");
      mockPrismaService.admin.count.mockResolvedValue(mockOrganizers.length);
      mockPrismaService.$transaction.mockResolvedValue([
        mockOrganizers.length,
        mockOrganizers,
      ]);

      const result = await organizersController.findAll(eventUuid, query);

      expect(result.data).toEqual(mockOrganizers);
      expect(result.meta).toEqual({
        page: 1,
        take: 10,
        itemCount: mockOrganizers.length,
        pageCount: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      });
      expect(mockPrismaService.admin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            permissions: {
              some: {
                eventUuid,
              },
            },
          },
        }),
      );
    });
  });
  it("should return 404 not found if event does not exist", async () => {
    const eventUuid = "bad-event-123";
    const query = new OrganizerListingDto();

    mockPrismaService.event.findUnique.mockResolvedValue(null);

    await expect(
      organizersController.findAll(eventUuid, query),
    ).rejects.toThrow(`Event with uuid: ${eventUuid} not found`);
  });
  it("should filter by active status", async () => {
    const eventUuid = "event-123";
    const query = new OrganizerListingDto();
    query.isActive = true;

    const mockOrganizers = [
      { firstName: "testName1", active: true },
      { firstName: "testName2", active: false },
    ];
    mockPrismaService.admin.findMany.mockResolvedValue(mockOrganizers);
    mockPrismaService.event.findUnique.mockResolvedValue("event");
    await organizersController.findAll(eventUuid, query);

    expect(mockPrismaService.admin.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          active: true,
        }),
      }),
    );
  });
  describe("Find organizer by event and admin id", () => {
    it("Should return admin when event and admin exists", async () => {
      const eventUuid = "event-test-123";
      const organizerUuid = "admin-test-123";

      const mockOrganizer = {
        firstName: "abc",
        uuid: organizerUuid,
        eventUuid,
      };

      mockPrismaService.admin.findFirst.mockResolvedValue(mockOrganizer);

      const result = await organizersController.findOne(
        eventUuid,
        organizerUuid,
      );

      expect(result).toEqual(mockOrganizer);

      expect(mockPrismaService.admin.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          where: expect.objectContaining({
            uuid: organizerUuid,
            permissions: {
              some: {
                eventUuid,
              },
            },
          }),
        }),
      );
    });
    it("Should return 404 if admin/event does not exist, or admin isnt an organizer of an event", async () => {
      const eventUuid = "bad-event-123";
      const organizerUuid = "bad-organizer-123";

      mockPrismaService.admin.findFirst.mockResolvedValue(null);

      await expect(
        organizersController.findOne(eventUuid, organizerUuid),
      ).rejects.toThrow(
        `organizer or event does not exist, or the organizer isnt assigned to event: ${eventUuid}`,
      );
    });
  });
  describe("Assign (create) organizer", () => {
    it("should add an organizer and return created permissions", async () => {
      const eventUuid = "event-uuid-123";
      const existingAdminUuid = "admin-uuid-123";

      const dto = {
        email: "organizer@example.com",
        firstName: "John",
        lastName: "Doe",
        permissionIds: ["perm-1", "perm-2"],
      };

      mockPrismaService.$transaction.mockImplementation((callback) =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        callback(mockPrismaService),
      );

      mockPrismaService.admin.findFirst.mockResolvedValue({
        uuid: existingAdminUuid,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
      });

      mockPrismaService.adminPermission.create.mockImplementation(
        (arguments_: {
          data: {
            eventUuid: string;
            adminUuid: string;
            permissionUuid: string;
          };
        }) => {
          const data = arguments_.data;
          return {
            uuid: "new-record-uuid",
            eventUuid: data.eventUuid,
            adminUuid: data.adminUuid,
            permissionUuid: data.permissionUuid,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        },
      );

      const result = await organizersController.create(eventUuid, dto);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);

      expect(result[0]).toMatchObject({
        eventUuid,
        adminUuid: existingAdminUuid,
        permissionUuid: dto.permissionIds[0],
      });

      expect(result[1]).toMatchObject({
        eventUuid,
        adminUuid: existingAdminUuid,
        permissionUuid: dto.permissionIds[1],
      });

      expect(mockPrismaService.admin.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: dto.email },
        }),
      );
    });

    it("should throw 404 if admin, event or permission does not exist", async () => {
      const eventUuid = "event-123";
      const dto = {
        email: "organizer@example.com",
        firstName: "John",
        lastName: "Doe",
        permissionIds: ["perm-1"],
      };

      mockPrismaService.admin.findFirst.mockResolvedValue(null);

      await expect(organizersController.create(eventUuid, dto)).rejects.toThrow(
        "admin, event or permission not found",
      );
    });
  });
  describe("Update organizer permissions", () => {
    it("should update permissions and return updated organizer", async () => {
      const eventUuid = "event-uuid-123";
      const organizerUuid = "admin-uuid-123";
      const dto = {
        permissionIds: ["new-perm-1", "new-perm-2"],
      };

      const expectedOrganizer = {
        uuid: organizerUuid,
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        permissions: [
          { permissionUuid: "new-perm-1", eventUuid },
          { permissionUuid: "new-perm-2", eventUuid },
        ],
      };

      mockPrismaService.$transaction.mockImplementation((callback) =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        callback(mockPrismaService),
      );

      mockPrismaService.admin.findFirst.mockResolvedValue({
        uuid: organizerUuid,
      });

      mockPrismaService.adminPermission.deleteMany.mockResolvedValue({
        count: 5,
      });

      mockPrismaService.adminPermission.create.mockImplementation(
        async (arguments_: {
          data: {
            eventUuid: string;
            adminUuid: string;
            permissionUuid: string;
          };
        }) => {
          const data = arguments_.data;
          return await Promise.resolve({
            uuid: "new-record-uuid",
            eventUuid: data.eventUuid,
            adminUuid: data.adminUuid,
            permissionUuid: data.permissionUuid,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        },
      );

      mockPrismaService.admin.findUnique.mockResolvedValue(expectedOrganizer);

      const result = await organizersController.update(
        eventUuid,
        organizerUuid,
        dto,
      );

      expect(result).toEqual(expectedOrganizer);

      expect(mockPrismaService.adminPermission.deleteMany).toHaveBeenCalledWith(
        {
          where: {
            eventUuid,
            adminUuid: organizerUuid,
          },
        },
      );

      expect(mockPrismaService.adminPermission.create).toHaveBeenCalledTimes(2);
    });

    it("should throw 404 if organizer does not exist", async () => {
      const eventUuid = "event-uuid-123";
      const organizerUuid = "admin-uuid-123";
      const dto = {
        permissionIds: ["perm-1"],
      };

      mockPrismaService.admin.findFirst.mockResolvedValue(null);

      await expect(
        organizersController.update(eventUuid, organizerUuid, dto),
      ).rejects.toThrow("admin, event or permission not found");
    });
  });
});
