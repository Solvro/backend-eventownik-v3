import { OrganizerType } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { AdminsService } from "./admins.service";

describe("AdminsService", () => {
  let adminService: AdminsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminsService, PrismaService],
    }).compile();

    adminService = module.get<AdminsService>(AdminsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // beforeAll(async () => {
  //   await prisma.admin.create({
  //     data: {
  //       firstName: "SuperAdmin",
  //       lastName: "Solvro",
  //       password: "changeMe",
  //       email: "admin@solvro.pl",
  //       type: OrganizerType.superadmin,
  //       active: true,
  //     },
  //   });
  // });

  it("should be defined", () => {
    expect(adminService).toBeDefined();
  });

  it("should return a user", async () => {
    await prisma.admin.deleteMany();
    const admin = await prisma.admin.create({
      data: {
        firstName: "SuperAdmin",
        lastName: "Solvro",
        password: "changeMe",
        email: "admin@solvro.pl",
        type: OrganizerType.superadmin,
        active: true,
      },
    });

    expect(await adminService.getAdminByUuid(admin.uuid)).toEqual(admin);
  });

  it("should throw ", async () => {
    await expect(
      adminService.getAdminByUuid("00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow();
  });
});
