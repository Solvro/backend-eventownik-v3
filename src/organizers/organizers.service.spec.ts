import { PrismaService } from "src/prisma/prisma.service";

import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";

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
  };

  beforeEach(async () => {
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
  describe("Assing an organizer to an event", () => {
    it("Should assing an organizer to an event", async () => {});
  });
});
