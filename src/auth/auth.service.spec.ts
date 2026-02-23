import * as bcrypt from "bcrypt";
import type { Admin } from "src/generated/prisma/client";

import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

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
    authAccessToken: {
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
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("register", () => {
    it("should hash password and create user", async () => {
      const registerData = {
        email: "new@example.com",
        password: "password123",
        firstName: "New",
        lastName: "User",
      };
      const hashedPassword = "hashedPassword123";
      jest.spyOn(bcrypt, "hash").mockImplementation(async () => hashedPassword);
      mockPrisma.admin.create.mockResolvedValue({
        ...mockAdmin,
        email: registerData.email,
      });

      const result = await service.register(registerData);

      expect(bcrypt.hash).toHaveBeenCalledWith(registerData.password, 10);
      expect(prisma.admin.create).toHaveBeenCalledWith({
        data: {
          ...registerData,
          password: hashedPassword,
        },
      });
      expect(result.email).toBe(registerData.email);
    });
  });

  describe("validateUser", () => {
    it("should return user if password matches", async () => {
      mockPrisma.admin.findUnique.mockResolvedValue(mockAdmin);
      jest.spyOn(bcrypt, "compare").mockImplementation(async () => true);

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
      jest.spyOn(bcrypt, "compare").mockImplementation(async () => false);

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
    it("should return access and refresh tokens", async () => {
      jest.spyOn(bcrypt, "hash").mockImplementation(async () => "refresh-hash");
      mockPrisma.authAccessToken.create.mockResolvedValue({ id: 1 });

      const result = await service.login(mockAdmin);

      expect(jwtService.sign).toHaveBeenCalled();
      expect(prisma.authAccessToken.create).toHaveBeenCalled();
      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("refresh_token");
    });
  });

  describe("refreshTokens", () => {
    it("should rotate tokens if refresh token is valid", async () => {
      const storedToken = {
        id: 1,
        token: "valid-token",
        expiresAt: new Date(Date.now() + 10_000),
        admin: mockAdmin,
      };
      mockPrisma.authAccessToken.findUnique.mockResolvedValue(storedToken);
      mockPrisma.authAccessToken.delete.mockResolvedValue(storedToken);
      jest
        .spyOn(service, "login")
        .mockResolvedValue({
          access_token: "new",
          refresh_token: "new-refresh",
        });

      const result = await service.refreshTokens("valid-token");

      expect(prisma.authAccessToken.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(service.login).toHaveBeenCalledWith(mockAdmin);
      expect(result).toEqual({
        access_token: "new",
        refresh_token: "new-refresh",
      });
    });

    it("should throw UnauthorizedException if token not found", async () => {
      mockPrisma.authAccessToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshTokens("invalid")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw and delete if token expired", async () => {
      const storedToken = {
        id: 1,
        token: "expired-token",
        expiresAt: new Date(Date.now() - 10_000),
      };
      mockPrisma.authAccessToken.findUnique.mockResolvedValue(storedToken);

      await expect(service.refreshTokens("expired-token")).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.authAccessToken.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });
  });
});
