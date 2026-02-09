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
    },
    event: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
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
});
