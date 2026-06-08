/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Prisma } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { StorageService } from "../storage/storage.service";

import type { ParticipantCreateDto } from "./dto/participant-create.dto";
import type { ParticipantListingDto } from "./dto/participant-listing.dto";
import type { ParticipantUpdateDto } from "./dto/participant-update.dto";
import { ParticipantsService } from "./participants.service";

describe("ParticipantsService", () => {
  let service: ParticipantsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    participant: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
    },
    attribute: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    participantAttribute: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    block: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParticipantsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: StorageService,
          useValue: { upload: jest.fn(), delete: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue("test-bucket") },
        },
      ],
    }).compile();

    service = module.get<ParticipantsService>(ParticipantsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();

    // Default transaction mock to just execute the callback
    (prisma.$transaction as jest.Mock).mockImplementation((argument) => {
      if (typeof argument === "function") {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
        return argument(prisma);
      }
      if (Array.isArray(argument)) {
        return Promise.all(argument);
      }
    });
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    const eventUuid = "event-123";
    const createDto: ParticipantCreateDto = {
      email: "test@example.com",
      participantAttributes: [{ attributeUuid: "attr-1", value: "val-1" }],
    };

    it("should successfully create a participant", async () => {
      mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventUuid });
      mockPrismaService.attribute.findMany.mockResolvedValue([
        { uuid: "attr-1", type: "text" },
      ]);
      const prismaParticipant = {
        uuid: "part-123",
        email: "test@example.com",
        createdAt: new Date(),
        attributes: [
          {
            attributeUuid: "attr-1",
            value: "val-1",
            createdAt: new Date(),
            updatedAt: new Date(),
            attribute: { name: "Attr 1" },
          },
        ],
      };
      mockPrismaService.participant.create.mockResolvedValue(prismaParticipant);

      const result = await service.create(eventUuid, createDto);

      expect(result.uuid).toBe("part-123");
      expect(result.attributes[0].name).toBe("Attr 1");
      expect(mockPrismaService.participant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: "test@example.com",
            eventUuid,
            attributes: {
              create: [{ attributeUuid: "attr-1", value: "val-1" }],
            },
          }),
        }),
      );
    });

    it("should throw NotFoundException if event does not exist", async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(null);

      await expect(service.create(eventUuid, createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw ConflictException on P2002 error", async () => {
      mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventUuid });
      mockPrismaService.attribute.findMany.mockResolvedValue([]);

      const error = Object.assign(new Error("P2002"), {
        name: "PrismaClientKnownRequestError",
        code: "P2002",
        clientVersion: "7.2.0",
      });
      Object.setPrototypeOf(
        error,
        Prisma.PrismaClientKnownRequestError.prototype,
      );

      mockPrismaService.participant.create.mockRejectedValue(error);

      await expect(service.create(eventUuid, createDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("register", () => {
    const eventUuid = "event-123";
    const email = "internal@example.com";
    const attributes = [{ attributeUuid: "attr-1", value: "val-1" }];

    it("should allow internal registration of a participant", async () => {
      mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventUuid });
      mockPrismaService.attribute.findMany.mockResolvedValue([
        { uuid: "attr-1", type: "text" },
      ]);
      mockPrismaService.participant.create.mockResolvedValue({
        uuid: "part-int",
        email,
        createdAt: new Date(),
        attributes: [
          {
            attributeUuid: "attr-1",
            value: "val-1",
            createdAt: new Date(),
            updatedAt: new Date(),
            attribute: { name: "Attr 1" },
          },
        ],
      });

      const result = await service.register(eventUuid, email, attributes);

      expect(result.email).toBe(email);
      expect(result.attributes[0].name).toBe("Attr 1");
      expect(mockPrismaService.participant.create).toHaveBeenCalled();
    });
  });

  describe("update", () => {
    const eventUuid = "event-123";
    const participantUuid = "part-123";
    const updateDto: ParticipantUpdateDto = {
      email: "updated@example.com",
      participantAttributes: [{ attributeUuid: "attr-1", value: "upd-1" }],
    };

    it("should successfully update a participant and its attributes", async () => {
      mockPrismaService.participant.findUnique.mockResolvedValue({
        uuid: participantUuid,
        eventUuid,
      });
      mockPrismaService.attribute.findMany.mockResolvedValue([
        { uuid: "attr-1", type: "text" },
      ]);
      mockPrismaService.participant.update.mockResolvedValue({
        uuid: participantUuid,
        email: "updated@example.com",
        createdAt: new Date(),
        attributes: [],
      });

      const result = await service.update(
        eventUuid,
        participantUuid,
        updateDto,
      );

      expect(result.email).toBe("updated@example.com");
      expect(
        mockPrismaService.participantAttribute.deleteMany,
      ).toHaveBeenCalled();
      expect(mockPrismaService.participant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: participantUuid },
          data: expect.objectContaining({
            email: "updated@example.com",
            attributes: {
              create: [{ attributeUuid: "attr-1", value: "upd-1" }],
            },
          }),
        }),
      );
    });

    it("should throw NotFoundException if participant does not belong to event", async () => {
      mockPrismaService.participant.findUnique.mockResolvedValue({
        uuid: participantUuid,
        eventUuid: "other-event",
      });

      await expect(
        service.update(eventUuid, participantUuid, updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("findAll", () => {
    it("should return paginated participants", async () => {
      const eventUuid = "event-123";

      const query = {
        page: 1,
        take: 10,
        skip: 0,
      } as unknown as ParticipantListingDto;

      const mockCount = 1;
      const mockParticipants = [
        {
          uuid: "part-123",
          email: "test@example.com",
          createdAt: new Date(),
          attributes: [],
        },
      ];

      mockPrismaService.participant.count.mockResolvedValue(mockCount);
      mockPrismaService.participant.findMany.mockResolvedValue(
        mockParticipants,
      );

      const result = await service.findAll(eventUuid, query);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].uuid).toBe("part-123");
      expect(result.meta.itemCount).toBe(mockCount);
    });
  });

  describe("findOne", () => {
    it("should return formatted participant with attributes and emails", async () => {
      const eventUuid = "event-123";
      const participantUuid = "part-123";

      const mockParticipant = {
        uuid: participantUuid,
        email: "test@example.com",
        createdAt: new Date(),
        attributes: [
          {
            attributeUuid: "attr-1",
            value: "test",
            createdAt: new Date(),
            updatedAt: new Date(),
            attribute: { name: "Attr Name" },
          },
        ],
        emails: [
          {
            uuid: "email-stat-1",
            status: "sent",
            sendAt: new Date(),
            sendBy: "system",
            email: {
              name: "Welcome Email",
              content: "...",
              trigger: "register",
              triggerValue: null,
            },
          },
        ],
      };

      mockPrismaService.participant.findFirst.mockResolvedValue(
        mockParticipant,
      );

      const result = await service.findOne(eventUuid, participantUuid);

      expect(result.uuid).toBe(participantUuid);
      expect(result.attributes[0].name).toBe("Attr Name");
      expect(result.emails?.[0].status).toBe("sent");
    });

    it("should throw NotFoundException if participant not found", async () => {
      mockPrismaService.participant.findFirst.mockResolvedValue(null);
      await expect(service.findOne("e-1", "p-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("remove", () => {
    it("should successfully remove a participant", async () => {
      const eventUuid = "event-123";
      const participantUuid = "part-123";

      mockPrismaService.participant.findFirst.mockResolvedValue({
        uuid: participantUuid,
        eventUuid,
        attributes: [],
      });

      await service.remove(eventUuid, participantUuid);

      expect(mockPrismaService.participant.delete).toHaveBeenCalledWith({
        where: { uuid: participantUuid },
      });
    });

    it("should throw error if participant to unregister not found", async () => {
      mockPrismaService.participant.findFirst.mockResolvedValue(null);
      await expect(service.remove("e", "p")).rejects.toThrow(NotFoundException);
    });
  });

  describe("removeMany", () => {
    it("should batch delete participants", async () => {
      const eventUuid = "event-123";
      const ids = ["p-1", "p-2"];

      mockPrismaService.participant.findMany.mockResolvedValue([
        { uuid: "p-1", attributes: [] },
        { uuid: "p-2", attributes: [] },
      ]);

      await service.removeMany(eventUuid, ids);

      expect(mockPrismaService.participant.deleteMany).toHaveBeenCalledWith({
        where: {
          uuid: { in: ids },
          eventUuid,
        },
      });
    });
  });

  describe("getPublicBlockAttributes", () => {
    const eventId = "event-123";
    const blockId = "block-123";
    it("should return empty array, when requestedFields is empty", async () => {
      const result = await service.getPublicBlockAttributes(
        eventId,
        blockId,
        [],
      );
      expect(result).toEqual([]);
    });

    it("should throw BadRequestException, when attributes does not belong to event", async () => {
      const requestedFields = ["attr-1", "attr-2"];
      mockPrismaService.attribute.count.mockResolvedValue(1);
      await expect(
        service.getPublicBlockAttributes(eventId, blockId, requestedFields),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.attribute.count).toHaveBeenCalledWith({
        where: {
          eventUuid: eventId,
          uuid: { in: requestedFields },
        },
      });

      expect(mockPrismaService.participant.findMany).not.toHaveBeenCalled();
    });

    it("should properly map email and participant attributes", async () => {
      const requestedFields = ["email", "attr-name", "attr-age"];
      mockPrismaService.attribute.count.mockResolvedValue(2);
      mockPrismaService.participant.findMany.mockResolvedValue([
        {
          email: "jan@doe.com",
          attributes: [
            { attributeUuid: "attr-name", value: "Jan" },
            { attributeUuid: "attr-age", value: "30" },
          ],
        },
      ]);
      const result = await service.getPublicBlockAttributes(
        eventId,
        blockId,
        requestedFields,
      );
      expect(result).toEqual([{ 0: "jan@doe.com", 1: "Jan", 2: "30" }]);
    });

    it("should return null value for missing attributes and hide email if not requested", async () => {
      const requestedFields = ["attr-name", "attr-age", "attr-city"];
      mockPrismaService.attribute.count.mockResolvedValue(3);
      mockPrismaService.participant.findMany.mockResolvedValue([
        {
          email: "jan@doe.com",
          attributes: [{ attributeUuid: "attr-name", value: "Jan" }],
        },
      ]);
      const result = await service.getPublicBlockAttributes(
        eventId,
        blockId,
        requestedFields,
      );
      expect(result).toEqual([
        {
          0: "Jan",
          1: null,
          2: null,
        },
      ]);

      expect(result[0]).not.toHaveProperty("email");
    });
  });
});
