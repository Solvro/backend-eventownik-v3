import * as bcrypt from "bcrypt";
import { createHash } from "node:crypto";
import type { Admin } from "src/generated/prisma/client";

import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
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

  const mockPrisma = {
    admin: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue("mock-token"),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("register", () => {
    it("should hash password and create user and omit password in response", async () => {
      const registerData = {
        email: "new@example.com",
        password: "password123",
        firstName: "New",
        lastName: "User",
      };
      const hashedPassword = "hashedPassword123";
      jest.spyOn(bcrypt, "hash").mockImplementation(() => hashedPassword);
      mockPrisma.admin.create.mockResolvedValue({
        ...mockAdmin,
        email: registerData.email,
        password: hashedPassword,
      });

      const result = await service.register(registerData);

      expect(bcrypt.hash).toHaveBeenCalledWith(registerData.password, 12);
      expect(mockPrisma.admin.create).toHaveBeenCalledWith({
        data: {
          ...registerData,
          password: hashedPassword,
        },
      });
      expect(result.email).toBe(registerData.email);
      expect(result).not.toHaveProperty("password");
    });

    it("should throw ConflictException if email already exists", async () => {
      const registerData = {
        email: "existing@example.com",
        password: "password123",
        firstName: "New",
        lastName: "User",
      };
      jest.spyOn(bcrypt, "hash").mockImplementation(() => "hash");
      mockPrisma.admin.create.mockRejectedValue({ code: "P2002" });

      await expect(service.register(registerData)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("validateUser", () => {
    it("should return user if password matches", async () => {
      mockPrisma.admin.findUnique.mockResolvedValue(mockAdmin);
      jest.spyOn(bcrypt, "compare").mockImplementation(() => true);

      const result = await service.validateUser(
        "test@example.com",
        "password123",
      );

      expect(result).toEqual(mockAdmin);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        "password123",
        mockAdmin.password,
      );
    });

    it("should return null if password does not match", async () => {
      mockPrisma.admin.findUnique.mockResolvedValue(mockAdmin);
      jest.spyOn(bcrypt, "compare").mockImplementation(() => false);

      const result = await service.validateUser(
        "test@example.com",
        "wrong-password",
      );

      expect(result).toBeNull();
    });

    it("should return null if user not found", async () => {
      mockPrisma.admin.findUnique.mockResolvedValue(null);

      const result = await service.validateUser("notfound@example.com", "any");

      expect(result).toBeNull();
    });
  });

  describe("login", () => {
    it("should return access and refresh tokens (securely)", async () => {
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 1 });

      const result = await service.login(mockAdmin);

      expect(mockJwtService.sign).toHaveBeenCalled();

      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          token: expect.any(String),
        }),
      });
      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("refresh_token");
      // Verify that the stored token is a SHA-256 hash of the returned token

      const storedToken =
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        mockPrisma.refreshToken.create.mock.calls[0][0].data.token as string;
      const expectedHash = createHash("sha256")
        .update(result.refresh_token)
        .digest("hex");
      expect(storedToken).toBe(expectedHash);
    });
  });

  describe("refreshTokens", () => {
    it("should rotate tokens if refresh token is valid", async () => {
      const plainToken = "valid-token";
      const hashedToken = createHash("sha256").update(plainToken).digest("hex");
      const storedToken = {
        uuid: "3e19d992-2ea5-4ed3-9245-6691c41f4f06",
        token: hashedToken,
        expiresAt: new Date(Date.now() + 10_000),
        admin: mockAdmin,
      };
      mockPrisma.refreshToken.findUnique.mockResolvedValue(storedToken);
      mockPrisma.refreshToken.delete.mockResolvedValue(storedToken);
      const loginSpy = jest.spyOn(service, "login").mockResolvedValue({
        access_token: "new",
        refresh_token: "new-refresh",
      });

      const result = await service.refreshTokens(plainToken);

      expect(mockPrisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { token: hashedToken },
        include: { admin: true },
      });
      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { uuid: "3e19d992-2ea5-4ed3-9245-6691c41f4f06" },
      });
      expect(loginSpy).toHaveBeenCalledWith(mockAdmin);
      expect(result).toEqual({
        access_token: "new",
        refresh_token: "new-refresh",
      });
    });

    it("should throw UnauthorizedException if token not found", async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshTokens("invalid")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw and delete if token expired", async () => {
      const storedToken = {
        uuid: "3e19d992-2ea5-4ed3-9245-6691c41f4f06",
        token: "expired-token",
        expiresAt: new Date(Date.now() - 10_000),
      };
      mockPrisma.refreshToken.findUnique.mockResolvedValue(storedToken);

      await expect(service.refreshTokens("expired-token")).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { uuid: "3e19d992-2ea5-4ed3-9245-6691c41f4f06" },
      });
    });
  });
});
