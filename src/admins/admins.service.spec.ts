/* eslint-disable @typescript-eslint/unbound-method */
import { OrganizerType } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { AdminsService } from "./admins.service";
import type { ListAdminDto } from "./dto/list-admin.dto";

describe("AdminsService", () => {
  let service: AdminsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    admin: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AdminsService>(AdminsService);
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
    it("should return paginated admins with default sort", async () => {
      const query = { page: 1, take: 10, skip: 0 } as unknown as ListAdminDto;
      const mockAdmins = [
        {
          uuid: "1",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
        },
      ];
      const mockCount = mockAdmins.length;
      (prisma.admin.count as jest.Mock).mockReturnValue("countQuery");
      (prisma.admin.findMany as jest.Mock).mockReturnValue("findManyQuery");
      (prisma.$transaction as jest.Mock).mockResolvedValue([
        mockCount,
        mockAdmins,
      ]);

      const result = await service.findAll(query); // TODO: zmienić findall bo tam jest śmieszne query

      expect(prisma.admin.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        orderBy: { createdAt: "desc" },
      });
      expect(result.data).toEqual(mockAdmins);
      expect(result.meta.itemCount).toEqual(mockCount);
    });

    it("should filter by email and firstName", async () => {
      const query = {
        page: 1,
        take: 10,
        skip: 0,
        email: "example@host.com",
        firstName: "John",
      } as unknown as ListAdminDto;
      const mockCount = 0;
      const mockAdmins: unknown[] = [];
      (prisma.$transaction as jest.Mock).mockResolvedValue([
        mockCount,
        mockAdmins,
      ]);

      await service.findAll(query);

      const expectedWhere = {
        email: { contains: "example@host.com", mode: "insensitive" },
        firstName: { contains: "John", mode: "insensitive" },
      };

      expect(prisma.admin.count).toHaveBeenCalledWith({ where: expectedWhere });

      expect(prisma.admin.findMany).toHaveBeenCalledWith(
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
        sort: "email:asc",
      } as unknown as ListAdminDto;
      const mockCount = 0;
      const mockAdmins: unknown[] = [];
      (prisma.$transaction as jest.Mock).mockResolvedValue([
        mockCount,
        mockAdmins,
      ]);

      await service.findAll(query);
      expect(prisma.admin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { email: "asc" },
        }),
      );
    });
    // TODO: więcej testów filtrów i sortowania, testy permisji ;P
  });

  describe("findOne", () => {
    it("should return an admin by id", async () => {
      const mockId = "1";
      const mockAdmin = {
        id: "1",
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
      };

      (prisma.admin.findUnique as jest.Mock).mockResolvedValue(mockAdmin);

      const result = await service.findOne(mockId);

      expect(prisma.admin.findUnique).toHaveBeenCalledWith({
        where: { uuid: mockId },
      });
      expect(result).toEqual(mockAdmin);
    });

    it("should throw NotFoundException if admin not found", async () => {
      const mockId = "nonexistent-id";
      (prisma.admin.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne(mockId)).rejects.toThrow("Admin not found");
      expect(prisma.admin.findUnique).toHaveBeenCalledWith({
        where: { uuid: mockId },
      });
    });
  });

  describe("create", () => {
    it("should create a new admin", async () => {
      const createAdminDto = {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        password: "password",
        type: OrganizerType.superadmin,
        active: true,
      };
      const mockAdmin = { uuid: "1", ...createAdminDto };

      (prisma.$transaction as jest.Mock).mockResolvedValue(mockAdmin);

      const result = await service.create(createAdminDto);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual(mockAdmin);
    });
    // TODO: testy dodwania permisji
  });

  describe("update", () => {
    it("should update an existing admin", async () => {
      const mockId = "1";
      const updateAdminDto = {
        firstName: "Jane",
        lastName: "Smith",
        email: "jane.smith@example.com",
      };

      const mockAdmin = { uuid: "1", ...updateAdminDto };

      (prisma.$transaction as jest.Mock).mockResolvedValue(mockAdmin);

      const result = await service.update(mockId, updateAdminDto);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual(mockAdmin);
    });
    it("should throw NotFoundException if admin to update not found", async () => {
      const mockId = "nonexistent-id";
      const updateAdminDto = {
        fistName: "Jane",
        lastName: "Smith",
        email: "jane.smith@example.com",
      };

      (prisma.$transaction as jest.Mock).mockResolvedValue(null);

      await expect(service.update(mockId, updateAdminDto)).rejects.toThrow(
        "Admin not found",
      );
    });
  });
  describe("remove", () => {
    it("should remove an existing admin", async () => {
      const mockId = "1";
      const mockAdmin = {
        uuid: "1",
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
      };

      (prisma.$transaction as jest.Mock).mockResolvedValue(mockAdmin);

      const result = await service.remove(mockId);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual(mockAdmin);
    });
  });
  it("should throw NotFoundException if admin to remove not found", async () => {
    const mockId = "nonexistent-id";

    (prisma.$transaction as jest.Mock).mockResolvedValue(null);

    await expect(service.remove(mockId)).rejects.toThrow("Admin not found");
  });
});
