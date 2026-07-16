/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { AttributeChangedEvent } from "src/common/events/attribute-changed.event";
import { ATTRIBUTE_CHANGED_EVENT } from "src/common/events/event-names.constants";
import { Prisma } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
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
  let storageService: StorageService;
  let eventEmitter: EventEmitter2;

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

  const mockStorageService = {
    upload: jest.fn(),
    delete: jest.fn(),
    getUrl: jest.fn(
      (bucket: string, key: string) =>
        `https://cdn.example.com/${bucket}/${key}`,
    ),
    extractKey: jest.fn((_bucket: string, value: string) => value),
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
          useValue: mockStorageService,
        },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue("test-bucket") },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ParticipantsService>(ParticipantsService);
    prisma = module.get<PrismaService>(PrismaService);
    storageService = module.get<StorageService>(StorageService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
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

  describe("file/drawing attribute lockdown", () => {
    const eventUuid = "event-123";
    const participantUuid = "part-123";
    const fileAttribute = { uuid: "attr-file", type: "file", config: null };

    it("create: rejects a non-empty file attribute value (no upload mechanism on this path)", async () => {
      mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventUuid });
      mockPrismaService.attribute.findMany.mockResolvedValue([fileAttribute]);

      await expect(
        service.create(eventUuid, {
          email: "test@example.com",
          participantAttributes: [
            { attributeUuid: "attr-file", value: "some-key.png" },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("update: accepts a resubmitted value matching the current one, and does not delete the underlying file", async () => {
      mockPrismaService.participant.findUnique.mockResolvedValue({
        uuid: participantUuid,
        eventUuid,
      });
      mockPrismaService.attribute.findMany.mockResolvedValue([fileAttribute]);
      mockPrismaService.participantAttribute.findMany.mockResolvedValue([
        { attributeUuid: "attr-file", value: "old-key.png" },
      ]);
      mockPrismaService.participant.update.mockResolvedValue({
        uuid: participantUuid,
        email: "test@example.com",
        createdAt: new Date(),
        attributes: [],
      });

      await service.update(eventUuid, participantUuid, {
        participantAttributes: [
          { attributeUuid: "attr-file", value: "old-key.png" },
        ],
      });

      expect(mockPrismaService.participant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            attributes: {
              create: [{ attributeUuid: "attr-file", value: "old-key.png" }],
            },
          }),
        }),
      );
      expect(mockStorageService.delete).not.toHaveBeenCalled();
    });

    it("update: rejects a value that does not match the current stored value", async () => {
      mockPrismaService.participant.findUnique.mockResolvedValue({
        uuid: participantUuid,
        eventUuid,
      });
      mockPrismaService.attribute.findMany.mockResolvedValue([fileAttribute]);
      mockPrismaService.participantAttribute.findMany.mockResolvedValue([
        { attributeUuid: "attr-file", value: "old-key.png" },
      ]);

      await expect(
        service.update(eventUuid, participantUuid, {
          participantAttributes: [
            { attributeUuid: "attr-file", value: "different-key.png" },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("update: self-heals when the currently stored value is already URL-corrupted", async () => {
      const prefix = "https://cdn.example.com/test-bucket/";
      mockPrismaService.participant.findUnique.mockResolvedValue({
        uuid: participantUuid,
        eventUuid,
      });
      mockPrismaService.attribute.findMany.mockResolvedValue([fileAttribute]);
      mockPrismaService.participantAttribute.findMany.mockResolvedValue([
        { attributeUuid: "attr-file", value: `${prefix}old-key.png` },
      ]);
      mockPrismaService.participant.update.mockResolvedValue({
        uuid: participantUuid,
        email: "test@example.com",
        createdAt: new Date(),
        attributes: [],
      });
      mockStorageService.extractKey.mockImplementation(
        (_bucket: string, value: string) => {
          let key = value;
          while (key.startsWith(prefix)) {
            key = key.slice(prefix.length);
          }
          return key;
        },
      );

      // The frontend resubmits exactly what a GET returned: the already
      // (singly) corrupted stored value with the resolved URL applied on
      // top of it once more.
      await service.update(eventUuid, participantUuid, {
        participantAttributes: [
          {
            attributeUuid: "attr-file",
            value: `${prefix}${prefix}old-key.png`,
          },
        ],
      });

      expect(mockPrismaService.participant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            attributes: {
              create: [{ attributeUuid: "attr-file", value: "old-key.png" }],
            },
          }),
        }),
      );

      // Restore the default identity implementation for later tests.
      mockStorageService.extractKey.mockImplementation(
        (_bucket: string, value: string) => value,
      );
    });

    it("update: allows clearing a file attribute to empty", async () => {
      mockPrismaService.participant.findUnique.mockResolvedValue({
        uuid: participantUuid,
        eventUuid,
      });
      mockPrismaService.attribute.findMany.mockResolvedValue([fileAttribute]);
      mockPrismaService.participant.update.mockResolvedValue({
        uuid: participantUuid,
        email: "test@example.com",
        createdAt: new Date(),
        attributes: [],
      });

      await service.update(eventUuid, participantUuid, {
        participantAttributes: [{ attributeUuid: "attr-file", value: "" }],
      });

      expect(mockPrismaService.participant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            attributes: {
              create: [{ attributeUuid: "attr-file", value: Prisma.JsonNull }],
            },
          }),
        }),
      );
    });

    it("update: trustedFileValues bypasses the match-check (forms.service path)", async () => {
      mockPrismaService.participant.findUnique.mockResolvedValue({
        uuid: participantUuid,
        eventUuid,
      });
      mockPrismaService.attribute.findMany.mockResolvedValue([fileAttribute]);
      mockPrismaService.participant.update.mockResolvedValue({
        uuid: participantUuid,
        email: "test@example.com",
        createdAt: new Date(),
        attributes: [],
      });

      await service.update(
        eventUuid,
        participantUuid,
        {
          participantAttributes: [
            { attributeUuid: "attr-file", value: "brand-new-key.png" },
          ],
        },
        { trustedFileValues: true },
      );

      expect(mockPrismaService.participant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            attributes: {
              create: [
                { attributeUuid: "attr-file", value: "brand-new-key.png" },
              ],
            },
          }),
        }),
      );
    });

    it("bulkUpdateAttributes: rejects a non-empty new value for a file-type attribute", async () => {
      mockPrismaService.attribute.findUnique.mockResolvedValue({
        uuid: "attr-file",
        eventUuid,
        type: "file",
      });
      mockPrismaService.participant.count.mockResolvedValue(1);

      await expect(
        service.bulkUpdateAttributes(eventUuid, "attr-file", "new-key.png", [
          "p-1",
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it("bulkUpdateAttributes: allows clearing a file-type attribute", async () => {
      mockPrismaService.attribute.findUnique.mockResolvedValue({
        uuid: "attr-file",
        eventUuid,
        type: "file",
      });
      mockPrismaService.participant.count.mockResolvedValue(1);
      mockPrismaService.attribute.findMany.mockResolvedValue([fileAttribute]);

      await service.bulkUpdateAttributes(eventUuid, "attr-file", undefined, [
        "p-1",
      ]);

      expect(
        mockPrismaService.participantAttribute.createMany,
      ).toHaveBeenCalledWith({
        data: [
          {
            participantUuid: "p-1",
            attributeUuid: "attr-file",
            value: Prisma.JsonNull,
          },
        ],
      });
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

    it("should resolve drawing attribute values to a storage URL, same as file", async () => {
      mockPrismaService.participant.findFirst.mockResolvedValue({
        uuid: "part-123",
        email: "test@example.com",
        createdAt: new Date(),
        attributes: [
          {
            attributeUuid: "attr-drawing",
            value: "drawing-key.png",
            createdAt: new Date(),
            updatedAt: new Date(),
            attribute: { name: "Signature", type: "drawing" },
          },
        ],
      });

      const result = await service.findOne("event-123", "part-123");

      expect(result.attributes[0].value).toBe(
        "https://cdn.example.com/test-bucket/drawing-key.png",
      );
    });
  });

  describe("findOnePublic", () => {
    it("should resolve file/drawing attribute values to a storage URL", async () => {
      mockPrismaService.participant.findFirst.mockResolvedValue({
        uuid: "part-123",
        email: "test@example.com",
        attributes: [
          {
            attributeUuid: "attr-file",
            value: "resume.pdf",
            attribute: { name: "Resume", type: "file" },
          },
          {
            attributeUuid: "attr-text",
            value: "hello",
            attribute: { name: "Name", type: "text" },
          },
        ],
      });

      const result = await service.findOnePublic("event-123", "part-123", []);

      expect(result.attributes[0].value).toBe(
        "https://cdn.example.com/test-bucket/resume.pdf",
      );
      expect(result.attributes[1].value).toBe("hello");
    });

    it("should throw NotFoundException if participant not found", async () => {
      mockPrismaService.participant.findFirst.mockResolvedValue(null);
      await expect(
        service.findOnePublic("event-123", "part-123", []),
      ).rejects.toThrow(NotFoundException);
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

  describe("bulkUpdateAttributes", () => {
    const eventUuid = "event-123";
    const attributeUuid = "attr-1";

    it("should throw NotFoundException if the attribute does not belong to the event", async () => {
      mockPrismaService.attribute.findUnique.mockResolvedValue({
        uuid: attributeUuid,
        eventUuid: "other-event",
        type: "text",
      });

      await expect(
        service.bulkUpdateAttributes(eventUuid, attributeUuid, "value", [
          "p-1",
        ]),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if a participant does not belong to the event", async () => {
      mockPrismaService.attribute.findUnique.mockResolvedValue({
        uuid: attributeUuid,
        eventUuid,
        type: "text",
      });
      mockPrismaService.participant.count.mockResolvedValue(1);

      await expect(
        service.bulkUpdateAttributes(eventUuid, attributeUuid, "value", [
          "p-1",
          "p-2",
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it("should update the value for every participant and emit ATTRIBUTE_CHANGED_EVENT per participant", async () => {
      mockPrismaService.attribute.findUnique.mockResolvedValue({
        uuid: attributeUuid,
        eventUuid,
        type: "text",
      });
      mockPrismaService.participant.count.mockResolvedValue(2);
      mockPrismaService.attribute.findMany.mockResolvedValue([
        { uuid: attributeUuid, type: "text", config: null },
      ]);

      await service.bulkUpdateAttributes(eventUuid, attributeUuid, "new-val", [
        "p-1",
        "p-2",
      ]);

      expect(
        mockPrismaService.participantAttribute.deleteMany,
      ).toHaveBeenCalledWith({
        where: { attributeUuid, participantUuid: { in: ["p-1", "p-2"] } },
      });
      expect(
        mockPrismaService.participantAttribute.createMany,
      ).toHaveBeenCalledWith({
        data: [
          { participantUuid: "p-1", attributeUuid, value: "new-val" },
          { participantUuid: "p-2", attributeUuid, value: "new-val" },
        ],
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(eventEmitter.emit as jest.Mock).toHaveBeenCalledTimes(2);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(eventEmitter.emit as jest.Mock).toHaveBeenCalledWith(
        ATTRIBUTE_CHANGED_EVENT,
        new AttributeChangedEvent(attributeUuid, "p-1", eventUuid, "new-val"),
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(eventEmitter.emit as jest.Mock).toHaveBeenCalledWith(
        ATTRIBUTE_CHANGED_EVENT,
        new AttributeChangedEvent(attributeUuid, "p-2", eventUuid, "new-val"),
      );
    });

    it("should allow bulk-clearing by omitting newValue", async () => {
      mockPrismaService.attribute.findUnique.mockResolvedValue({
        uuid: attributeUuid,
        eventUuid,
        type: "text",
      });
      mockPrismaService.participant.count.mockResolvedValue(1);
      mockPrismaService.attribute.findMany.mockResolvedValue([
        { uuid: attributeUuid, type: "text", config: null },
      ]);

      await service.bulkUpdateAttributes(eventUuid, attributeUuid, undefined, [
        "p-1",
      ]);

      expect(
        mockPrismaService.participantAttribute.createMany,
      ).toHaveBeenCalledWith({
        data: [
          { participantUuid: "p-1", attributeUuid, value: Prisma.JsonNull },
        ],
      });
    });

    it("should clean up all existing S3 file keys when bulk-clearing a file attribute, deduping", async () => {
      mockPrismaService.attribute.findUnique.mockResolvedValue({
        uuid: attributeUuid,
        eventUuid,
        type: "file",
      });
      mockPrismaService.participant.count.mockResolvedValue(3);
      mockPrismaService.attribute.findMany.mockResolvedValue([
        { uuid: attributeUuid, type: "file", config: null },
      ]);
      mockPrismaService.participantAttribute.findMany.mockResolvedValueOnce([
        { value: "old-key-1" },
        { value: "old-key-1" },
        { value: "old-key-2" },
        { value: null },
      ]);

      await service.bulkUpdateAttributes(eventUuid, attributeUuid, undefined, [
        "p-1",
        "p-2",
        "p-3",
      ]);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(storageService.delete as jest.Mock).toHaveBeenCalledTimes(2);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(storageService.delete as jest.Mock).toHaveBeenCalledWith(
        "test-bucket",
        "old-key-1",
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(storageService.delete as jest.Mock).toHaveBeenCalledWith(
        "test-bucket",
        "old-key-2",
      );
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
