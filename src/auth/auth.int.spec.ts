import type { Request, Response } from "express";
import type { Admin } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

describe("AuthController integration tests", () => {
  let controller: AuthController;

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
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    logout: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: PrismaService, useValue: {} }, // Not used directly in controller
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === "REFRESH_TOKEN_TTL_DAYS") {
                return 3;
              }
              return "localhost";
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
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

      const { password, ...strippedMock } = mockAdmin;
      mockAuthService.register.mockResolvedValue(strippedMock);

      const result = await controller.register(dto);

      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(strippedMock);
      expect(result).not.toHaveProperty("password");
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

      const mockResponse = {
        cookie: jest.fn(),
      } as unknown as Response;

      const result = await controller.login(dto, mockResponse);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        "refresh_token",
        "rt",
        expect.objectContaining({
          httpOnly: true,
          sameSite: "strict",
          path: "/api/v3/auth",
          secure: expect.any(Boolean) as boolean,
          maxAge: expect.any(Number) as number,
          domain: expect.any(String) as string,
        }),
      );

      expect(mockAuthService.validateUser).toHaveBeenCalledWith(
        dto.email,
        dto.password,
      );
      expect(mockAuthService.login).toHaveBeenCalledWith(mockAdmin);
      expect(result).toEqual({ access_token: "at" });
    });

    it("should throw UnauthorizedException if validation fails", async () => {
      const dto = { email: "test@example.com", password: "wrong" };
      mockAuthService.validateUser.mockResolvedValue(null);

      const mockResponse = {
        cookie: jest.fn(),
      } as unknown as Response;

      await expect(controller.login(dto, mockResponse)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("refresh", () => {
    it("should call authService.refreshTokens", async () => {
      mockAuthService.refreshTokens.mockResolvedValue({
        access_token: "new-at",
        refresh_token: "new-rt",
      });

      const mockResponse = {
        cookie: jest.fn(),
      } as unknown as Response;

      const mockRequest = {
        cookies: { refresh_token: "old-rt" },
      } as unknown as Request;

      const result = await controller.refresh(mockRequest, mockResponse);

      expect(mockAuthService.refreshTokens).toHaveBeenCalledWith("old-rt");
      expect(result).toEqual({
        access_token: "new-at",
      });
    });
  });

  describe("forgotPassword", () => {
    it("should call authService.forgotPassword and return default message", async () => {
      const mockEmail = "abc@example.com";
      mockAuthService.forgotPassword({ email: mockEmail });
      mockAuthService.forgotPassword.mockResolvedValue(true);

      const result = await controller.forgotPassword({
        email: mockEmail,
      });
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(mockEmail);
      expect(result).toEqual({
        message: "If the email exists, a reset link has been sent",
      });
    });
  });

  describe("resetPassword", () => {
    it("should call authService.resetPassword and return default message", async () => {
      const dto = { token: "abc-token", password: "abc-password" };

      mockAuthService.resetPassword.mockResolvedValue(true);

      const result = await controller.resetPassword(dto);

      expect(result).toEqual({
        message: "Password has been reset",
      });
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
        dto.token,
        dto.password,
      );
    });
  });
  describe("logout", () => {
    it("should clear the cookie and call authService.logout on success", async () => {
      const mockRequest = {
        cookies: { refresh_token: "valid-rt" },
      } as unknown as Request;

      const mockResponse = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      mockAuthService.logout.mockResolvedValue({
        message: "Logged out successfully!",
      });

      const result = await controller.logout(mockRequest, mockResponse);

      expect(mockAuthService.logout).toHaveBeenCalledWith("valid-rt");

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        "refresh_token",
        expect.objectContaining({
          httpOnly: true,
          sameSite: "strict",
          path: "/api/v3/auth",
          secure: expect.any(Boolean) as boolean,
          domain: expect.any(String) as string,
        }),
      );

      expect(result).toEqual({ message: "Logged out successfully!" });
    });

    it("should not call service if cookie is missing", async () => {
      const mockRequest = {
        cookies: {},
      } as unknown as Request;

      const mockResponse = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      const result = await controller.logout(mockRequest, mockResponse);

      expect(mockAuthService.logout).not.toHaveBeenCalled();
      expect(result).toEqual({ message: "Logged out successfully!" });
    });
  });
});
