/* eslint-disable @typescript-eslint/unbound-method */
import type { AuthUser } from "src/auth/jwt.strategy";
import { OrganizerType } from "src/generated/prisma/enums";

import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { AdminsController } from "./admins.controller";
import { AdminsService } from "./admins.service";

describe("AdminsController", () => {
  let controller: AdminsController;
  let service: AdminsService;

  const mockAdminsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminsController],
      providers: [
        {
          provide: AdminsService,
          useValue: mockAdminsService,
        },
      ],
    }).compile();

    controller = module.get<AdminsController>(AdminsController);
    service = module.get<AdminsService>(AdminsService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("create", () => {
    it("should create a new admin", async () => {
      const createAdminDto = {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        password: "password123",
        type: OrganizerType.organizer,
        active: true,
      };
      const mockAdmin = { id: "1", ...createAdminDto };
      (service.create as jest.Mock).mockResolvedValue(mockAdmin);

      const mockSuperAdmin: AuthUser = {
        uuid: "superadmin-uuid",
        email: "superadmin@example.com",
        firstName: "Super",
        lastName: "Admin",
        password: "superpassword",
        active: true,
        permissions: [],
        type: OrganizerType.superadmin,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await controller.create(createAdminDto, {
        user: mockSuperAdmin,
      });

      expect(service.create).toHaveBeenCalledWith(createAdminDto);
      expect(result).toEqual(mockAdmin);
    });

    it("should throw an error if user is not superadmin", async () => {
      const createAdminDto = {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        password: "password123",
        type: OrganizerType.organizer,
        active: true,
      };
      const mockNonSuperAdmin: AuthUser = {
        uuid: "non-superadmin-uuid",
        email: "non.superadmin@example.com",
        firstName: "Regular",
        lastName: "User",
        password: "password123",
        active: true,
        permissions: [],
        type: OrganizerType.organizer,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(
        controller.create(createAdminDto, { user: mockNonSuperAdmin }),
      ).rejects.toThrow("Invalid account type");
    });

    it("should throw an error if admin is inactive", async () => {
      const createAdminDto = {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        password: "password123",
        type: OrganizerType.organizer,
        active: true,
      };
      const mockSuperAdmin: AuthUser = {
        uuid: "superadmin-uuid",
        email: "superadmin@example.com",
        firstName: "Super",
        lastName: "Admin",
        password: "superpassword",
        active: false,
        permissions: [],
        type: OrganizerType.superadmin,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(
        controller.create(createAdminDto, { user: mockSuperAdmin }),
      ).rejects.toThrow("Invalid account type");
    });
  });
});
