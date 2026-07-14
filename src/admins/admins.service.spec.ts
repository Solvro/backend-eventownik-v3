import type { AuthUser } from "src/auth/jwt.strategy";
import { OrganizerType } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { AdminsService } from "./admins.service";
import type { ListAdminDto } from "./dto/list-admin.dto";
import type { UpdateAdminDto } from "./dto/update-admin.dto";
import { Admin } from "./entities/admin.entity";

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

      const result = await service.findAll(query);

      expect(mockPrismaService.admin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
          orderBy: [{ createdAt: "desc" }],
        }),
      );

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

      expect(mockPrismaService.admin.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });

      expect(mockPrismaService.admin.findMany).toHaveBeenCalledWith(
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
      expect(mockPrismaService.admin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ email: "asc" }],
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

      expect(mockPrismaService.admin.findUnique).toHaveBeenCalledWith({
        where: { uuid: mockId },
      });
      expect(result).toEqual(mockAdmin);
    });

    it("should throw NotFoundException if admin not found", async () => {
      const mockId = "nonexistent-id";
      (prisma.admin.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne(mockId)).rejects.toThrow(
        "Admin with given ID was not found.",
      );
      expect(mockPrismaService.admin.findUnique).toHaveBeenCalledWith({
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

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(result).toEqual(mockAdmin);
    });

    it("should throw an error if email already exists", async () => {
      const createAdminDto = {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        password: "password",
        type: OrganizerType.superadmin,
        active: true,
      };

      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error(`Admin with email ${createAdminDto.email} already exists`),
      );

      await expect(service.create(createAdminDto)).rejects.toThrow(
        `Admin with email ${createAdminDto.email} already exists`,
      );
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update an existing admin", async () => {
      const mockId = "1";
      const updateAdminDto: UpdateAdminDto = {
        firstName: "Jane",
        lastName: "Smith",
        email: "jane.smith@example.com",
      } as unknown as UpdateAdminDto;

      const mockAdmin = Object.assign(new Admin(), {
        uuid: mockId,
        firstName: updateAdminDto.firstName,
        lastName: updateAdminDto.lastName,
        email: updateAdminDto.email,
      });

      (prisma.admin.update as jest.Mock).mockResolvedValue(mockAdmin);

      const result = await service.update(mockId, updateAdminDto);

      expect(mockPrismaService.admin.update).toHaveBeenCalled();
      expect(result).toEqual(mockAdmin);
    });
    it("should throw NotFoundException if admin to update not found", async () => {
      const mockId = "nonexistent-id";
      const updateAdminDto: UpdateAdminDto = {
        firstName: "Jane",
        lastName: "Smith",
        email: "jane.smith@example.com",
      } as unknown as UpdateAdminDto;

      (prisma.admin.update as jest.Mock).mockRejectedValue(
        new Error(`Admin with UUID ${mockId} not found`),
      );

      await expect(service.update(mockId, updateAdminDto)).rejects.toThrow(
        `Admin with UUID ${mockId} not found`,
      );
    });
  });
  describe("remove", () => {
    it("should remove an existing admin", async () => {
      const mockId = "1";

      (prisma.admin.delete as jest.Mock).mockResolvedValue(null);

      const result = await service.remove(mockId, 2 as unknown as AuthUser);

      expect(mockPrismaService.admin.delete).toHaveBeenCalled();
      expect(typeof result).toEqual("object");
    });
  });
  it("should throw NotFoundException if admin to remove not found", async () => {
    const mockId = "nonexistent-id";

    (prisma.admin.delete as jest.Mock).mockRejectedValue(
      new Error("Admin with UUID nonexistent-id not found"),
    );

    await expect(
      service.remove(mockId, 2 as unknown as AuthUser),
    ).rejects.toThrow(`Admin with UUID ${mockId} not found`);
  });
});
