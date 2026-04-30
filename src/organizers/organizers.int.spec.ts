import { PermissionType } from "src/generated/prisma/client";
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
    eventPermission: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetAllMocks();
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

      mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventUuid });
      mockPrismaService.admin.findMany.mockResolvedValue(mockOrganizers);
      mockPrismaService.admin.count.mockResolvedValue(mockOrganizers.length);
      mockPrismaService.$transaction.mockResolvedValue([
        mockOrganizers.length,
        mockOrganizers,
      ]);

      const result = await organizersController.findAll(eventUuid, query);

      expect(result.data).toEqual(mockOrganizers);
      expect(result.meta.itemCount).toEqual(mockOrganizers.length);
      expect(mockPrismaService.admin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          where: expect.objectContaining({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            OR: expect.arrayContaining([
              expect.objectContaining({
                permissions: { some: { eventUuid } },
              }),
            ]),
          }),
        }),
      );
    });
  });

  describe("Find organizer by event and admin id", () => {
    it("Should return admin when event and admin exists", async () => {
      const eventUuid = "event-test-123";
      const organizerUuid = "admin-test-123";
      const mockOrganizer = { firstName: "abc", uuid: organizerUuid };

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
          }),
        }),
      );
    });
  });

  describe("Assign (create) organizer", () => {
    it("should add an organizer and return updated admin", async () => {
      const eventUuid = "event-uuid-123";
      const adminUuid = "admin-uuid-123";
      const dto = {
        email: "organizer@example.com",
        permissions: [PermissionType.MANAGE_EVENT],
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
        return await callback(mockPrismaService);
      });

      mockPrismaService.admin.findFirst.mockResolvedValue({
        uuid: adminUuid,
        email: dto.email,
      });
      mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventUuid });
      mockPrismaService.eventPermission.createMany.mockResolvedValue({
        count: 1,
      });
      mockPrismaService.admin.findUnique.mockResolvedValue({
        uuid: adminUuid,
        email: dto.email,
      });

      const result = await organizersController.create(eventUuid, dto);

      expect(result).toBeDefined();
      expect(mockPrismaService.eventPermission.createMany).toHaveBeenCalledWith(
        {
          data: [
            {
              eventUuid,
              adminUuid,
              permission: PermissionType.MANAGE_EVENT,
            },
          ],
        },
      );
    });
  });

  describe("Update organizer permissions", () => {
    it("should update permissions and return updated organizer", async () => {
      const eventUuid = "event-uuid-123";
      const organizerUuid = "admin-uuid-123";
      const dto = { permissions: [PermissionType.MANAGE_ALL] };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
        return await callback(mockPrismaService);
      });

      mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventUuid });
      mockPrismaService.admin.findUnique.mockResolvedValue({
        uuid: organizerUuid,
      });
      mockPrismaService.admin.findFirst.mockResolvedValue({
        uuid: organizerUuid,
      });
      mockPrismaService.eventPermission.deleteMany.mockResolvedValue({
        count: 1,
      });
      mockPrismaService.eventPermission.createMany.mockResolvedValue({
        count: 1,
      });
      mockPrismaService.admin.findUnique.mockResolvedValue({
        uuid: organizerUuid,
        email: "test@test.pl",
      });

      const result = await organizersController.update(
        eventUuid,
        organizerUuid,
        dto,
      );

      expect(result).toBeDefined();
      expect(mockPrismaService.eventPermission.deleteMany).toHaveBeenCalled();
      expect(mockPrismaService.eventPermission.createMany).toHaveBeenCalled();
    });
  });

  describe("Remove organizer", () => {
    it("should remove organizer if there are more than 1 organizers assigned", async () => {
      const eventUuid = "event-uuid-123";
      const organizerUuid = "admin-uuid-123";

      mockPrismaService.admin.findFirst.mockResolvedValue({
        uuid: organizerUuid,
      });
      mockPrismaService.admin.count.mockResolvedValue(2);
      mockPrismaService.eventPermission.deleteMany.mockResolvedValue({
        count: 1,
      });

      await organizersController.remove(eventUuid, organizerUuid);

      expect(mockPrismaService.eventPermission.deleteMany).toHaveBeenCalledWith(
        {
          where: { eventUuid, adminUuid: organizerUuid },
        },
      );
    });

    it("should throw 403 Forbidden if trying to remove the last organizer", async () => {
      const eventUuid = "event-uuid-123";
      const organizerUuid = "last-admin-uuid";

      mockPrismaService.admin.findFirst.mockResolvedValue({
        uuid: organizerUuid,
      });
      mockPrismaService.admin.count.mockResolvedValue(1);

      await expect(
        organizersController.remove(eventUuid, organizerUuid),
      ).rejects.toThrow("Unable to remove the last organizer from the event.");
    });
  });
});
