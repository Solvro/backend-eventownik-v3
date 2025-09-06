import type { Prisma } from "@prisma/client";
import { EmailStatus } from "@prisma/client";

import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";
import type { CreateParticipantDto } from "./dto/create-participant.dto";
import type { QueryParticipantDto } from "./dto/query-participant.dto";
import { ParticipantService } from "./participant.service";

interface PrismaMock {
  participant: {
    create: jest.Mock;
    count: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    deleteMany: jest.Mock;
  };
  $transaction: jest.Mock;
}

type ParticipantWithRelations = Prisma.ParticipantGetPayload<{
  include: { attributes: { include: { attribute: true } }; emails: true };
}>;

describe("ParticipantService (unit)", () => {
  let service: ParticipantService;
  let prisma: PrismaMock;

  const eventUuid = "11111111-1111-1111-1111-111111111111";
  const participantUuid = "22222222-2222-2222-2222-222222222222";

  const withRels: ParticipantWithRelations = {
    uuid: participantUuid,
    email: "john@example.com",
    eventUuid,
    createdAt: new Date("2025-01-01T10:00:00.000Z"),
    updatedAt: new Date("2025-01-01T10:00:00.000Z"),
    attributes: [
      {
        uuid: "pa-1",
        participantUuid,
        attributeUuid: "attr-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        value: "M",
        attribute: {
          uuid: "attr-1",
          eventUuid,
          type: "select",
          createdAt: new Date(),
          updatedAt: new Date(),
          showInList: true,
          options: [],
          name: "tshirt_size",
        },
      },
    ],
    emails: [
      {
        uuid: "pe-1",
        status: EmailStatus.sent,
        sendAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        sendBy: "tester",
        participantUuid,
        emailUuid: "email-1",
      },
      {
        uuid: "pe-2",
        status: EmailStatus.failed,
        sendAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        sendBy: "tester",
        participantUuid,
        emailUuid: "email-2",
      },
    ],
  };

  beforeEach(async () => {
    const prismaMock: PrismaMock = {
      participant: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ParticipantService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = moduleRef.get(ParticipantService);
    prisma = moduleRef.get<PrismaMock>(PrismaService);
  });

  afterEach(() => jest.resetAllMocks());

  it("create → shape + snake_case", async () => {
    prisma.participant.create.mockResolvedValue({
      uuid: participantUuid,
      email: "john@example.com",
      eventUuid,
      createdAt: withRels.createdAt,
      updatedAt: withRels.updatedAt,
    });

    prisma.participant.findUnique.mockResolvedValue(withRels);

    const dto: CreateParticipantDto = { email: "john@example.com" };
    const response = await service.create(eventUuid, dto);

    expect(response).toEqual({
      uuid: participantUuid,
      email: "john@example.com",
      created_at: withRels.createdAt,
      updated_at: withRels.updatedAt,
      attributes: { tshirt_size: "M" },
      emails_pending: 0,
      emails_sent: 1,
      emails_failed: 1,
    });
  });

  it("findAll → { data, metadata }", async () => {
    prisma.$transaction.mockResolvedValueOnce([1, [withRels]]);

    const query: QueryParticipantDto = { page: 1, perPage: 10 };
    const result = await service.findAll(eventUuid, query);

    expect(result.metadata).toEqual({
      page: 1,
      per_page: 10,
      total: 1,
      total_pages: 1,
    });
    expect(result.data[0]).toMatchObject({
      uuid: participantUuid,
      attributes: { tshirt_size: "M" },
    });
  });

  it("findOne → 404 gdy brak", async () => {
    prisma.participant.findFirst.mockResolvedValue(null);
    await expect(service.findOne(eventUuid, participantUuid)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("findOne → shape", async () => {
    prisma.participant.findFirst.mockResolvedValue(withRels);
    const result = await service.findOne(eventUuid, participantUuid);
    expect(result.created_at).toEqual(withRels.createdAt);
  });

  it("update → shape", async () => {
    prisma.participant.findFirst.mockResolvedValue({ uuid: participantUuid });
    prisma.participant.update.mockResolvedValue({});
    prisma.participant.findUnique.mockResolvedValue(withRels);

    const result = await service.update(eventUuid, participantUuid, {
      email: "new@example.com",
    });
    expect(result.uuid).toBe(participantUuid);
  });

  it("remove → zwraca void (throw 404 jeśli brak)", async () => {
    prisma.participant.deleteMany.mockResolvedValue({ count: 1 });
    await expect(
      service.remove(eventUuid, participantUuid),
    ).resolves.toBeUndefined();
  });
});
