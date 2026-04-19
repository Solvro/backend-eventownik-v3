/* eslint-disable @typescript-eslint/unbound-method */
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

      const result = await controller.create(createAdminDto);

      expect(service.create).toHaveBeenCalledWith(createAdminDto);
      expect(result).toEqual(mockAdmin);
    });
  });
});
