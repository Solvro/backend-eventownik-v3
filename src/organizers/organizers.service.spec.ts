import { PermissionType } from "src/generated/prisma/client";
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
    eventPermission: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetAllMocks();
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
      mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventUuid });
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
      };

      mockPrismaService.admin.findFirst.mockResolvedValue(mockOrganizer);

      const result = await service.findOne(eventUuid, organizerUuid);

      expect(result).toEqual(mockOrganizer);
    });
  });

  describe("Adding an organizer to an event", () => {
    it("Should assign an organizer to an event", async () => {
      const eventUuid = "test-event-123";
      const existingAdminUuid = "admin-uuid-123";

      const dto: CreateOrganizerDto = {
        email: "organizer@example.com",
        permissions: [PermissionType.MANAGE_EVENT, PermissionType.MANAGE_FORM],
      };

      mockPrismaService.$transaction.mockImplementation((callback) =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        callback(mockPrismaService),
      );

      mockPrismaService.admin.findFirst.mockResolvedValue({
        uuid: existingAdminUuid,
        email: dto.email,
      });

      mockPrismaService.event.findUnique.mockResolvedValue({
        uuid: eventUuid,
      });

      const expectedAdmin = {
        uuid: existingAdminUuid,
        email: dto.email,
        permissions: [
          { eventUuid, permission: PermissionType.MANAGE_EVENT },
          { eventUuid, permission: PermissionType.MANAGE_FORM },
        ],
      };

      mockPrismaService.eventPermission.createMany.mockResolvedValue({
        count: 2,
      });

      mockPrismaService.admin.findUnique.mockResolvedValue(expectedAdmin);

      const result = await service.create(eventUuid, dto);

      expect(mockPrismaService.eventPermission.createMany).toHaveBeenCalledWith(
        {
          data: [
            {
              eventUuid,
              adminUuid: existingAdminUuid,
              permission: PermissionType.MANAGE_EVENT,
            },
            {
              eventUuid,
              adminUuid: existingAdminUuid,
              permission: PermissionType.MANAGE_FORM,
            },
          ],
        },
      );
      expect(result).toEqual(expectedAdmin);
    });
  });

  describe("Update organizer permissions", () => {
    it("Should update organizer permissions and return updated organizer", async () => {
      const eventUuid = "event-123";
      const organizerUuid = "admin-123";
      const dto = {
        permissions: [PermissionType.MANAGE_PARTICIPANT],
      };

      const expectedOrganizer = {
        uuid: organizerUuid,
        email: "test@example.com",
        permissions: [
          { permission: PermissionType.MANAGE_PARTICIPANT, eventUuid },
        ],
      };

      mockPrismaService.$transaction.mockImplementation((callback) =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        callback(mockPrismaService),
      );

      mockPrismaService.event.findUnique.mockResolvedValue({
        uuid: eventUuid,
      });

      mockPrismaService.admin.findUnique
        .mockResolvedValueOnce({ uuid: organizerUuid })
        .mockResolvedValueOnce(expectedOrganizer);

      mockPrismaService.admin.findFirst.mockResolvedValue({
        uuid: organizerUuid,
      });

      mockPrismaService.eventPermission.deleteMany.mockResolvedValue({
        count: 2,
      });

      mockPrismaService.eventPermission.createMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.update(eventUuid, organizerUuid, dto);

      expect(mockPrismaService.eventPermission.deleteMany).toHaveBeenCalledWith(
        {
          where: {
            eventUuid,
            adminUuid: organizerUuid,
          },
        },
      );

      expect(mockPrismaService.eventPermission.createMany).toHaveBeenCalledWith(
        {
          data: [
            {
              eventUuid,
              adminUuid: organizerUuid,
              permission: PermissionType.MANAGE_PARTICIPANT,
            },
          ],
        },
      );

      expect(result).toEqual(expectedOrganizer);
    });
  });

  describe("Remove organizer", () => {
    it("Should remove organizer if there are more than 1 organizers assigned", async () => {
      const eventUuid = "event-123";
      const organizerUuid = "admin-to-remove";

      mockPrismaService.admin.findFirst.mockResolvedValue({
        uuid: organizerUuid,
      });

      mockPrismaService.admin.count.mockResolvedValue(5);

      mockPrismaService.eventPermission.deleteMany.mockResolvedValue({
        count: 2,
      });

      await service.remove(eventUuid, organizerUuid);

      expect(mockPrismaService.admin.findFirst).toHaveBeenCalledWith({
        where: {
          uuid: organizerUuid,
          OR: [
            {
              events: {
                some: { uuid: eventUuid },
              },
            },
            {
              permissions: {
                some: { eventUuid },
              },
            },
          ],
        },
      });

      expect(mockPrismaService.admin.count).toHaveBeenCalledWith({
        where: {
          OR: [
            {
              events: {
                some: { uuid: eventUuid },
              },
            },
            {
              permissions: {
                some: { eventUuid },
              },
            },
          ],
        },
      });

      expect(mockPrismaService.eventPermission.deleteMany).toHaveBeenCalledWith(
        {
          where: {
            eventUuid,
            adminUuid: organizerUuid,
          },
        },
      );
    });
  });
});
