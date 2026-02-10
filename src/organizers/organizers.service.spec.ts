import { PrismaService } from "src/prisma/prisma.service";

import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";

import type { CreateOrganizerDto } from "./dto/create-organizer.dto";
import { OrganizerListingDto } from "./dto/organizer-listing.dto";
import { OrganizersService } from "./organizers.service";

describe("OrganizersService", () => {
  let service: OrganizersService;
  const mockPrismaService = {
    $transaction: jest.fn(),
    admin: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
    },
    adminPermission: {
      create: jest.fn(),
      createMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrganizersService, PrismaService],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    service = module.get<OrganizersService>(OrganizersService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
  describe("Find all organizers by event", () => {
    it("should return a list of organizers", async () => {
      const eventUuid = "test-uuid-123";
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

      const query = new OrganizerListingDto();

      const result = await service.findAll(eventUuid, query);

      expect(result.data).toEqual(mockOrganizers);
      expect(result.meta.itemCount).toEqual(mockOrganizers.length);
    });
    it("should throw a 404 not found if event does not exist", async () => {
      const eventUuid = "bad-uuid-321";
      const query = new OrganizerListingDto();
      mockPrismaService.event.findUnique.mockResolvedValue(null);

      await expect(service.findAll(eventUuid, query)).rejects.toThrow(
        `Event with uuid: ${eventUuid} not found`,
      );
    });
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

      const result = await service.findOne(eventUuid, organizerUuid);

      expect(result).toEqual(mockOrganizer);
    });
  });
  describe("Adding an organizer to an event", () => {
    it("Should assing an organizer to an event", async () => {
      const eventUuid = "test-event-123";
      const existingAdminUuid = "admin-uuid-123";

      const dto: CreateOrganizerDto = {
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
        createdAt: new Date(),
        updatedAt: new Date(),
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

      const result = await service.create(eventUuid, dto);

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
    });
  });
  describe("Update organizer permissions", () => {
    it("Should update organizer permissions and return updated organizer", async () => {
      const eventUuid = "event-123";
      const organizerUuid = "admin-123";
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

      const result = await service.update(eventUuid, organizerUuid, dto);

      expect(result).toEqual(expectedOrganizer);

      expect(mockPrismaService.admin.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            uuid: organizerUuid,
            permissions: {
              some: {
                eventUuid,
              },
            },
          },
        }),
      );

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
  });
});
