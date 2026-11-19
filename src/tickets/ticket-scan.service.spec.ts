import { Prisma } from "src/generated/prisma/client";
import { AttributeType, TicketMode } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { TicketScanStatus } from "./entities/ticket-scan-result.entity";
import { TicketScanService } from "./ticket-scan.service";
import { TicketsService } from "./tickets.service";

describe("TicketScanService", () => {
  let service: TicketScanService;

  const eventUuid = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
  const otherEventUuid = "3fa85f64-5717-4562-b3fc-2c963f66afff";
  const ticketUuid = "3fa85f64-5717-4562-b3fc-2c963f66afb0";
  const participantUuid = "3fa85f64-5717-4562-b3fc-2c963f66afc0";
  const adminUuid = "3fa85f64-5717-4562-b3fc-2c963f66afd0";
  const blockAttributeUuid = "3fa85f64-5717-4562-b3fc-2c963f66afa7";
  const textAttributeUuid = "3fa85f64-5717-4562-b3fc-2c963f66afa8";
  const workshopA = "3fa85f64-5717-4562-b3fc-2c963f66af01";
  const workshopB = "3fa85f64-5717-4562-b3fc-2c963f66af02";
  const confirmedAt = new Date("2026-01-01T10:00:00.000Z");

  const mockPrismaService = {
    ticket: { findFirst: jest.fn() },
    block: { findFirst: jest.fn(), findMany: jest.fn() },
    participant: { findUnique: jest.fn() },
    attribute: { findMany: jest.fn() },
    ticketCheckIn: { findFirst: jest.fn(), create: jest.fn() },
  };

  const eventTicket = {
    uuid: ticketUuid,
    eventUuid,
    mode: TicketMode.EVENT,
    attributeUuid: null,
    attributes: [{ attributeUuid: textAttributeUuid }],
  };

  const blockTicket = {
    ...eventTicket,
    mode: TicketMode.BLOCK,
    attributeUuid: blockAttributeUuid,
    attributes: [
      { attributeUuid: textAttributeUuid },
      { attributeUuid: blockAttributeUuid },
    ],
  };

  const participant = (overrides: Record<string, unknown> = {}) => ({
    uuid: participantUuid,
    email: "jan@example.com",
    eventUuid,
    attributes: [{ attributeUuid: textAttributeUuid, value: "vegan" }],
    ...overrides,
  });

  const withBlocks = (value: unknown) =>
    participant({
      attributes: [
        { attributeUuid: textAttributeUuid, value: "vegan" },
        { attributeUuid: blockAttributeUuid, value },
      ],
    });

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketScanService,
        TicketsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get(TicketScanService);

    mockPrismaService.ticket.findFirst.mockResolvedValue(eventTicket);
    mockPrismaService.participant.findUnique.mockResolvedValue(participant());
    mockPrismaService.ticketCheckIn.findFirst.mockResolvedValue(null);
    mockPrismaService.attribute.findMany.mockResolvedValue([
      { uuid: textAttributeUuid, name: "Diet", type: AttributeType.text },
    ]);
  });

  describe("scan, EVENT ticket", () => {
    it("returns VALID with participant and shown attributes", async () => {
      const result = await service.scan(eventUuid, ticketUuid, {
        token: "tok",
      });

      expect(result).toEqual({
        status: TicketScanStatus.VALID,
        participant: { uuid: participantUuid, email: "jan@example.com" },
        attributes: [
          {
            attributeUuid: textAttributeUuid,
            name: "Diet",
            type: AttributeType.text,
            value: "vegan",
          },
        ],
      });
      expect(mockPrismaService.participant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ticketToken: "tok" } }),
      );
    });

    it("returns null for a shown attribute the participant never filled", async () => {
      mockPrismaService.participant.findUnique.mockResolvedValue(
        participant({ attributes: [] }),
      );

      const result = await service.scan(eventUuid, ticketUuid, {
        token: "tok",
      });

      expect(result.attributes?.[0].value).toBeNull();
    });

    it("returns ALREADY_CONFIRMED with the confirmation time and no admin", async () => {
      mockPrismaService.ticketCheckIn.findFirst.mockResolvedValue({
        confirmedAt,
      });

      const result = await service.scan(eventUuid, ticketUuid, {
        token: "tok",
      });

      expect(result.status).toBe(TicketScanStatus.ALREADY_CONFIRMED);
      expect(result.confirmedAt).toEqual(confirmedAt);
      expect(result).not.toHaveProperty("confirmedByAdminUuid");
    });

    it("looks for a check-in with a null block", async () => {
      await service.scan(eventUuid, ticketUuid, { token: "tok" });

      expect(mockPrismaService.ticketCheckIn.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ticketUuid, participantUuid, blockUuid: null },
        }),
      );
    });

    it("returns INVALID_TICKET for an unknown token without any data", async () => {
      mockPrismaService.participant.findUnique.mockResolvedValue(null);

      const result = await service.scan(eventUuid, ticketUuid, {
        token: "nope",
      });

      expect(result).toEqual({ status: TicketScanStatus.INVALID_TICKET });
    });

    it("returns WRONG_EVENT without any payload for another event's participant", async () => {
      mockPrismaService.participant.findUnique.mockResolvedValue(
        participant({ eventUuid: otherEventUuid }),
      );

      const result = await service.scan(eventUuid, ticketUuid, {
        token: "tok",
      });

      expect(result).toEqual({ status: TicketScanStatus.WRONG_EVENT });
    });

    it("rejects a blockUuid on an EVENT ticket", async () => {
      await expect(
        service.scan(eventUuid, ticketUuid, {
          token: "tok",
          blockUuid: workshopA,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws NotFoundException for a ticket of another event", async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(null);

      await expect(
        service.scan(eventUuid, ticketUuid, { token: "tok" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("scan, BLOCK ticket", () => {
    beforeEach(() => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(blockTicket);
      mockPrismaService.block.findFirst.mockResolvedValue({ uuid: workshopA });
      mockPrismaService.block.findMany.mockResolvedValue([
        { uuid: workshopA, name: "Workshop A" },
        { uuid: workshopB, name: "Workshop B" },
      ]);
      mockPrismaService.attribute.findMany.mockResolvedValue([
        { uuid: textAttributeUuid, name: "Diet", type: AttributeType.text },
        {
          uuid: blockAttributeUuid,
          name: "Workshops",
          type: AttributeType.block,
        },
      ]);
    });

    it("requires a blockUuid", async () => {
      await expect(
        service.scan(eventUuid, ticketUuid, { token: "tok" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws NotFoundException for a block outside the ticket's attribute", async () => {
      mockPrismaService.block.findFirst.mockResolvedValue(null);

      await expect(
        service.scan(eventUuid, ticketUuid, {
          token: "tok",
          blockUuid: workshopA,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("returns VALID when the participant is in the block, with resolved block names", async () => {
      mockPrismaService.participant.findUnique.mockResolvedValue(
        withBlocks([workshopA, workshopB]),
      );

      const result = await service.scan(eventUuid, ticketUuid, {
        token: "tok",
        blockUuid: workshopA,
      });

      expect(result.status).toBe(TicketScanStatus.VALID);
      expect(
        result.attributes?.find((a) => a.attributeUuid === blockAttributeUuid)
          ?.blockNames,
      ).toEqual(["Workshop A", "Workshop B"]);
    });

    it("accepts a single block stored as a string", async () => {
      mockPrismaService.participant.findUnique.mockResolvedValue(
        withBlocks(workshopA),
      );

      const result = await service.scan(eventUuid, ticketUuid, {
        token: "tok",
        blockUuid: workshopA,
      });

      expect(result.status).toBe(TicketScanStatus.VALID);
    });

    it("returns WRONG_BLOCK with every block the participant is in", async () => {
      mockPrismaService.participant.findUnique.mockResolvedValue(
        withBlocks([workshopB]),
      );

      const result = await service.scan(eventUuid, ticketUuid, {
        token: "tok",
        blockUuid: workshopA,
      });

      expect(result).toEqual({
        status: TicketScanStatus.WRONG_BLOCK,
        blockNames: ["Workshop B"],
      });
    });

    it("returns WRONG_BLOCK with no names when the participant has no block", async () => {
      mockPrismaService.participant.findUnique.mockResolvedValue(
        withBlocks(null),
      );

      const result = await service.scan(eventUuid, ticketUuid, {
        token: "tok",
        blockUuid: workshopA,
      });

      expect(result).toEqual({
        status: TicketScanStatus.WRONG_BLOCK,
        blockNames: [],
      });
    });

    it("tracks check-ins per block", async () => {
      mockPrismaService.participant.findUnique.mockResolvedValue(
        withBlocks([workshopA, workshopB]),
      );

      await service.scan(eventUuid, ticketUuid, {
        token: "tok",
        blockUuid: workshopB,
      });

      expect(mockPrismaService.ticketCheckIn.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ticketUuid, participantUuid, blockUuid: workshopB },
        }),
      );
    });

    it("checks WRONG_EVENT before block membership", async () => {
      mockPrismaService.participant.findUnique.mockResolvedValue(
        participant({ eventUuid: otherEventUuid }),
      );

      const result = await service.scan(eventUuid, ticketUuid, {
        token: "tok",
        blockUuid: workshopA,
      });

      expect(result.status).toBe(TicketScanStatus.WRONG_EVENT);
    });
  });

  describe("confirm", () => {
    const createdRow = {
      uuid: "3fa85f64-5717-4562-b3fc-2c963f66afe0",
      ticketUuid,
      participantUuid,
      blockUuid: null,
      confirmedAt,
      confirmedByAdminUuid: adminUuid,
    };

    it("creates a check-in attributed to the admin and hides the admin in the response", async () => {
      mockPrismaService.ticketCheckIn.create.mockResolvedValue(createdRow);

      const result = await service.confirm(
        eventUuid,
        ticketUuid,
        { token: "tok" },
        adminUuid,
      );

      expect(mockPrismaService.ticketCheckIn.create).toHaveBeenCalledWith({
        data: {
          ticketUuid,
          participantUuid,
          blockUuid: null,
          confirmedByAdminUuid: adminUuid,
        },
      });
      expect(result).toEqual({
        uuid: createdRow.uuid,
        ticketUuid,
        participantUuid,
        blockUuid: null,
        confirmedAt,
      });
    });

    it("throws ConflictException when already confirmed", async () => {
      mockPrismaService.ticketCheckIn.findFirst.mockResolvedValue({
        confirmedAt,
      });

      await expect(
        service.confirm(eventUuid, ticketUuid, { token: "tok" }, adminUuid),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.ticketCheckIn.create).not.toHaveBeenCalled();
    });

    it("throws ConflictException when a concurrent scanner wins the race", async () => {
      mockPrismaService.ticketCheckIn.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("unique", {
          code: "P2002",
          clientVersion: "test",
        }),
      );

      await expect(
        service.confirm(eventUuid, ticketUuid, { token: "tok" }, adminUuid),
      ).rejects.toThrow(ConflictException);
    });

    it.each([
      ["INVALID_TICKET", null],
      ["WRONG_EVENT", participant({ eventUuid: otherEventUuid })],
    ])("re-validates and refuses %s", async (_status, found) => {
      mockPrismaService.participant.findUnique.mockResolvedValue(found);

      await expect(
        service.confirm(eventUuid, ticketUuid, { token: "tok" }, adminUuid),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(mockPrismaService.ticketCheckIn.create).not.toHaveBeenCalled();
    });

    it("refuses WRONG_BLOCK and never writes", async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(blockTicket);
      mockPrismaService.block.findFirst.mockResolvedValue({ uuid: workshopA });
      mockPrismaService.block.findMany.mockResolvedValue([]);
      mockPrismaService.participant.findUnique.mockResolvedValue(
        participant({
          attributes: [
            { attributeUuid: blockAttributeUuid, value: [workshopB] },
          ],
        }),
      );

      await expect(
        service.confirm(
          eventUuid,
          ticketUuid,
          { token: "tok", blockUuid: workshopA },
          adminUuid,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(mockPrismaService.ticketCheckIn.create).not.toHaveBeenCalled();
    });

    it("stores the block for a BLOCK ticket", async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(blockTicket);
      mockPrismaService.block.findFirst.mockResolvedValue({ uuid: workshopA });
      mockPrismaService.block.findMany.mockResolvedValue([]);
      mockPrismaService.attribute.findMany.mockResolvedValue([]);
      mockPrismaService.participant.findUnique.mockResolvedValue(
        participant({
          attributes: [
            { attributeUuid: blockAttributeUuid, value: [workshopA] },
          ],
        }),
      );
      mockPrismaService.ticketCheckIn.create.mockResolvedValue({
        ...createdRow,
        blockUuid: workshopA,
      });

      await service.confirm(
        eventUuid,
        ticketUuid,
        { token: "tok", blockUuid: workshopA },
        adminUuid,
      );

      expect(mockPrismaService.ticketCheckIn.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ blockUuid: workshopA }) as unknown,
      });
    });
  });
});
