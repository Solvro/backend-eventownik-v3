import { Prisma } from "src/generated/prisma/client";
import { AttributeType, TicketMode } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { TicketsService } from "./tickets.service";

describe("TicketsService", () => {
  let service: TicketsService;

  const eventUuid = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
  const blockAttributeUuid = "3fa85f64-5717-4562-b3fc-2c963f66afa7";
  const textAttributeUuid = "3fa85f64-5717-4562-b3fc-2c963f66afa8";
  const fileAttributeUuid = "3fa85f64-5717-4562-b3fc-2c963f66afa9";
  const ticketUuid = "3fa85f64-5717-4562-b3fc-2c963f66afb0";

  const mockTx = {
    ticketAttribute: { deleteMany: jest.fn(), createMany: jest.fn() },
    ticket: { update: jest.fn() },
  };

  const mockPrismaService = {
    event: { findUnique: jest.fn() },
    attribute: { findFirst: jest.fn(), findMany: jest.fn() },
    ticket: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const ticketRow = (overrides: Record<string, unknown> = {}) => ({
    uuid: ticketUuid,
    eventUuid,
    mode: TicketMode.EVENT,
    attributeUuid: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    attributes: [],
    ...overrides,
  });

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get(TicketsService);

    mockPrismaService.event.findUnique.mockResolvedValue({ uuid: eventUuid });
    mockPrismaService.$transaction.mockImplementation(
      async (callback: (tx: typeof mockTx) => unknown) =>
        await callback(mockTx),
    );
  });

  describe("create", () => {
    it("creates an EVENT ticket", async () => {
      mockPrismaService.ticket.create.mockResolvedValue(ticketRow());

      const result = await service.create(eventUuid, {
        mode: TicketMode.EVENT,
      });

      expect(result).toEqual({
        uuid: ticketUuid,
        eventUuid,
        mode: TicketMode.EVENT,
        attributeUuid: null,
        shownAttributeUuids: [],
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      expect(mockPrismaService.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventUuid,
            mode: TicketMode.EVENT,
            attributeUuid: null,
          }) as unknown,
        }),
      );
    });

    it("creates a BLOCK ticket with shown attributes", async () => {
      mockPrismaService.attribute.findFirst.mockResolvedValue({
        type: AttributeType.block,
      });
      mockPrismaService.attribute.findMany.mockResolvedValue([
        { uuid: textAttributeUuid, type: AttributeType.text },
      ]);
      mockPrismaService.ticket.create.mockResolvedValue(
        ticketRow({
          mode: TicketMode.BLOCK,
          attributeUuid: blockAttributeUuid,
          attributes: [{ attributeUuid: textAttributeUuid }],
        }),
      );

      const result = await service.create(eventUuid, {
        mode: TicketMode.BLOCK,
        attributeUuid: blockAttributeUuid,
        shownAttributeUuids: [textAttributeUuid],
      });

      expect(result.attributeUuid).toBe(blockAttributeUuid);
      expect(result.shownAttributeUuids).toEqual([textAttributeUuid]);
    });

    it("throws NotFoundException when the event does not exist", async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(null);

      await expect(
        service.create(eventUuid, { mode: TicketMode.EVENT }),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects an EVENT ticket with an attribute", async () => {
      await expect(
        service.create(eventUuid, {
          mode: TicketMode.EVENT,
          attributeUuid: blockAttributeUuid,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a BLOCK ticket for an attribute outside the event", async () => {
      mockPrismaService.attribute.findFirst.mockResolvedValue(null);

      await expect(
        service.create(eventUuid, {
          mode: TicketMode.BLOCK,
          attributeUuid: blockAttributeUuid,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects a BLOCK ticket for a non-block attribute", async () => {
      mockPrismaService.attribute.findFirst.mockResolvedValue({
        type: AttributeType.text,
      });

      await expect(
        service.create(eventUuid, {
          mode: TicketMode.BLOCK,
          attributeUuid: textAttributeUuid,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects shown attributes outside the event", async () => {
      mockPrismaService.attribute.findMany.mockResolvedValue([]);

      await expect(
        service.create(eventUuid, {
          mode: TicketMode.EVENT,
          shownAttributeUuids: [textAttributeUuid],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects file attributes as shown attributes", async () => {
      mockPrismaService.attribute.findMany.mockResolvedValue([
        { uuid: fileAttributeUuid, type: AttributeType.file },
      ]);

      await expect(
        service.create(eventUuid, {
          mode: TicketMode.EVENT,
          shownAttributeUuids: [fileAttributeUuid],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("maps a unique violation to ConflictException", async () => {
      mockPrismaService.ticket.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("unique", {
          code: "P2002",
          clientVersion: "test",
        }),
      );

      await expect(
        service.create(eventUuid, { mode: TicketMode.EVENT }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("findAll", () => {
    it("returns the tickets of the event", async () => {
      mockPrismaService.ticket.findMany.mockResolvedValue([ticketRow()]);

      const result = await service.findAll(eventUuid);

      expect(result).toHaveLength(1);
      expect(mockPrismaService.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { eventUuid } }),
      );
    });

    it("throws NotFoundException when the event does not exist", async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(null);

      await expect(service.findAll(eventUuid)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("findOne", () => {
    it("scopes the lookup to the event", async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(ticketRow());

      await service.findOne(eventUuid, ticketUuid);

      expect(mockPrismaService.ticket.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { uuid: ticketUuid, eventUuid } }),
      );
    });

    it("throws NotFoundException for an unknown ticket", async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(null);

      await expect(service.findOne(eventUuid, ticketUuid)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("update", () => {
    it("replaces the shown attributes", async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(ticketRow());
      mockPrismaService.attribute.findMany.mockResolvedValue([
        { uuid: textAttributeUuid, type: AttributeType.text },
      ]);
      mockTx.ticket.update.mockResolvedValue(
        ticketRow({ attributes: [{ attributeUuid: textAttributeUuid }] }),
      );

      const result = await service.update(eventUuid, ticketUuid, {
        shownAttributeUuids: [textAttributeUuid],
      });

      expect(mockTx.ticketAttribute.deleteMany).toHaveBeenCalledWith({
        where: { ticketUuid },
      });
      expect(mockTx.ticketAttribute.createMany).toHaveBeenCalledWith({
        data: [{ ticketUuid, attributeUuid: textAttributeUuid }],
      });
      expect(result.shownAttributeUuids).toEqual([textAttributeUuid]);
    });

    it("rejects file attributes", async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(ticketRow());
      mockPrismaService.attribute.findMany.mockResolvedValue([
        { uuid: fileAttributeUuid, type: AttributeType.file },
      ]);

      await expect(
        service.update(eventUuid, ticketUuid, {
          shownAttributeUuids: [fileAttributeUuid],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it("throws NotFoundException for an unknown ticket", async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(null);

      await expect(
        service.update(eventUuid, ticketUuid, { shownAttributeUuids: [] }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("deletes the ticket", async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(ticketRow());

      await service.remove(eventUuid, ticketUuid);

      expect(mockPrismaService.ticket.delete).toHaveBeenCalledWith({
        where: { uuid: ticketUuid },
      });
    });

    it("throws NotFoundException for an unknown ticket", async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(null);

      await expect(service.remove(eventUuid, ticketUuid)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.ticket.delete).not.toHaveBeenCalled();
    });
  });
});
