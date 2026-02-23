import type { Admin } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import { UnauthorizedException } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

describe("AuthController integration tests", () => {
  let controller: AuthController;
  let service: AuthService;

  const mockAdmin: Admin = {
    uuid: "user-uuid",
    email: "test@example.com",
    password: "hashedPassword",
    firstName: "John",
    lastName: "Doe",
    type: "organizer",
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAuthService = {
    register: jest.fn(),
    validateUser: jest.fn(),
    login: jest.fn(),
    refreshTokens: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: PrismaService, useValue: {} }, // Not used directly in controller
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("register", () => {
    it("should call authService.register", async () => {
      const dto = {
        email: "new@example.com",
        password: "password123",
        firstName: "New",
        lastName: "User",
      };
      mockAuthService.register.mockResolvedValue(mockAdmin);

      const result = await controller.register(dto);

      expect(service.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockAdmin);
    });
  });

  describe("login", () => {
    it("should call authService.validateUser and authService.login on success", async () => {
      const dto = { email: "test@example.com", password: "password123" };
      mockAuthService.validateUser.mockResolvedValue(mockAdmin);
      mockAuthService.login.mockResolvedValue({
        access_token: "at",
        refresh_token: "rt",
      });

      const result = await controller.login(dto);

      expect(service.validateUser).toHaveBeenCalledWith(
        dto.email,
        dto.password,
      );
      expect(service.login).toHaveBeenCalledWith(mockAdmin);
      expect(result).toEqual({ access_token: "at", refresh_token: "rt" });
    });

    it("should throw UnauthorizedException if validation fails", async () => {
      const dto = { email: "test@example.com", password: "wrong" };
      mockAuthService.validateUser.mockResolvedValue(null);

      await expect(controller.login(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("refresh", () => {
    it("should call authService.refreshTokens", async () => {
      const body = { refresh_token: "rt-123" };
      mockAuthService.refreshTokens.mockResolvedValue({
        access_token: "new-at",
        refresh_token: "new-rt",
      });

      const result = await controller.refresh(body);

      expect(service.refreshTokens).toHaveBeenCalledWith(body.refresh_token);
      expect(result).toEqual({
        access_token: "new-at",
        refresh_token: "new-rt",
      });
    });
  });
});
