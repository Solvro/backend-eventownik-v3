import { AttributeType, TicketMode } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import { BadRequestException } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import type { TicketParticipantsListingDto } from "./dto/ticket-participants-listing.dto";
import { TicketParticipantsService } from "./ticket-participants.service";
import { TicketsService } from "./tickets.service";

const query = (
  overrides: Partial<TicketParticipantsListingDto> = {},
): TicketParticipantsListingDto =>
  ({ page: 1, take: 10, skip: 0, ...overrides }) as never;

describe("TicketParticipantsService", () => {
  let service: TicketParticipantsService;

  const eventUuid = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
  const ticketUuid = "3fa85f64-5717-4562-b3fc-2c963f66afb0";
  const blockAttributeUuid = "3fa85f64-5717-4562-b3fc-2c963f66afa7";
  const textAttributeUuid = "3fa85f64-5717-4562-b3fc-2c963f66afa8";
  const workshopA = "3fa85f64-5717-4562-b3fc-2c963f66af01";
  const confirmedAt = new Date("2026-01-01T10:00:00.000Z");

  const mockPrismaService = {
    ticket: { findFirst: jest.fn() },
    block: { findFirst: jest.fn(), findMany: jest.fn() },
    participant: { count: jest.fn(), findMany: jest.fn() },
    attribute: { findMany: jest.fn() },
    $transaction: jest.fn(),
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

  const row = (overrides: Record<string, unknown> = {}) => ({
    uuid: "p1",
    email: "jan@example.com",
    attributes: [{ attributeUuid: textAttributeUuid, value: "vegan" }],
    ticketCheckIns: [],
    ...overrides,
  });

  const stubPage = (rows: unknown[], attributes: unknown[]) => {
    mockPrismaService.$transaction.mockResolvedValue([
      rows.length,
      rows,
      attributes,
    ]);
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketParticipantsService,
        TicketsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get(TicketParticipantsService);

    mockPrismaService.ticket.findFirst.mockResolvedValue(eventTicket);
    mockPrismaService.block.findFirst.mockResolvedValue({ uuid: workshopA });
    mockPrismaService.block.findMany.mockResolvedValue([]);
    mockPrismaService.participant.count.mockReturnValue("count");
    mockPrismaService.participant.findMany.mockReturnValue("findMany");
    mockPrismaService.attribute.findMany.mockReturnValue("attributes");
  });

  const lastWhere = () =>
    (
      mockPrismaService.participant.findMany.mock.calls.at(-1) as [
        { where: unknown },
      ]
    )[0].where;

  it("lists event participants with shown attributes and attendance", async () => {
    stubPage(
      [
        row(),
        row({
          uuid: "p2",
          email: "ola@example.com",
          ticketCheckIns: [{ confirmedAt }],
        }),
      ],
      [{ uuid: textAttributeUuid, name: "Diet", type: AttributeType.text }],
    );

    const result = await service.findAll(eventUuid, ticketUuid, query());

    expect(result.meta.itemCount).toBe(2);
    expect(result.data).toEqual([
      {
        uuid: "p1",
        email: "jan@example.com",
        attributes: [
          {
            attributeUuid: textAttributeUuid,
            name: "Diet",
            type: AttributeType.text,
            value: "vegan",
          },
        ],
        attendance: { confirmed: false, confirmedAt: null },
      },
      expect.objectContaining({
        uuid: "p2",
        attendance: { confirmed: true, confirmedAt },
      }),
    ]);
  });

  it("returns only the ticket's shown attributes, never the full record", async () => {
    stubPage([row()], []);

    await service.findAll(eventUuid, ticketUuid, query());

    expect(mockPrismaService.participant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          attributes: {
            where: { attributeUuid: { in: [textAttributeUuid] } },
            select: { attributeUuid: true, value: true },
          },
        }) as unknown,
      }),
    );
  });

  it("scopes the check-in lookup to the ticket and a null block for EVENT tickets", async () => {
    stubPage([], []);

    await service.findAll(eventUuid, ticketUuid, query());

    expect(mockPrismaService.participant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          ticketCheckIns: {
            where: { ticketUuid, blockUuid: null },
            select: { confirmedAt: true },
          },
        }) as unknown,
      }),
    );
  });

  it("filters by confirmed=true and confirmed=false", async () => {
    stubPage([], []);

    await service.findAll(eventUuid, ticketUuid, query({ confirmed: true }));
    expect(lastWhere()).toEqual({
      eventUuid,
      AND: [{ ticketCheckIns: { some: { ticketUuid, blockUuid: null } } }],
    });

    await service.findAll(eventUuid, ticketUuid, query({ confirmed: false }));
    expect(lastWhere()).toEqual({
      eventUuid,
      AND: [{ ticketCheckIns: { none: { ticketUuid, blockUuid: null } } }],
    });
  });

  it("filters by an email fragment case-insensitively", async () => {
    stubPage([], []);

    await service.findAll(eventUuid, ticketUuid, query({ search: "kow" }));

    expect(lastWhere()).toEqual({
      eventUuid,
      AND: [{ email: { contains: "kow", mode: "insensitive" } }],
    });
  });

  it("lists only participants in the block for BLOCK tickets, with resolved block names", async () => {
    mockPrismaService.ticket.findFirst.mockResolvedValue(blockTicket);
    mockPrismaService.block.findMany.mockResolvedValue([
      { uuid: workshopA, name: "Workshop A" },
    ]);
    stubPage(
      [
        row({
          attributes: [
            { attributeUuid: blockAttributeUuid, value: [workshopA] },
          ],
          ticketCheckIns: [{ confirmedAt }],
        }),
      ],
      [
        {
          uuid: blockAttributeUuid,
          name: "Workshops",
          type: AttributeType.block,
        },
      ],
    );

    const result = await service.findAll(
      eventUuid,
      ticketUuid,
      query({ blockUuid: workshopA }),
    );

    expect(lastWhere()).toEqual({
      eventUuid,
      AND: [
        {
          attributes: {
            some: {
              attributeUuid: blockAttributeUuid,
              OR: [
                { value: { array_contains: workshopA } },
                { value: { equals: workshopA } },
              ],
            },
          },
        },
      ],
    });
    expect(result.data[0].attributes[0].blockNames).toEqual(["Workshop A"]);
    expect(result.data[0].attendance.confirmed).toBe(true);
  });

  it("requires blockUuid for BLOCK tickets", async () => {
    mockPrismaService.ticket.findFirst.mockResolvedValue(blockTicket);

    await expect(
      service.findAll(eventUuid, ticketUuid, query()),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects blockUuid for EVENT tickets", async () => {
    await expect(
      service.findAll(eventUuid, ticketUuid, query({ blockUuid: workshopA })),
    ).rejects.toThrow(BadRequestException);
  });
});
