import { Test } from "@nestjs/testing";

import type { CreateParticipantDto } from "./dto/create-participant.dto";
import type { QueryParticipantDto } from "./dto/query-participant.dto";
import type { UpdateParticipantDto } from "./dto/update-participant.dto";
import { ParticipantController } from "./participant.controller";
import { ParticipantService } from "./participant.service";

interface ParticipantResponse {
  uuid: string;
  email: string;
  created_at?: Date;
  updated_at?: Date;
  attributes?: Record<string, string>;
  emails_pending?: number;
  emails_sent?: number;
  emails_failed?: number;
}

interface FindAllResponse {
  data: ParticipantResponse[];
  metadata: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

interface ParticipantServiceMock {
  create: jest.Mock<
    Promise<ParticipantResponse>,
    [string, CreateParticipantDto]
  >;
  findAll: jest.Mock<Promise<FindAllResponse>, [string, QueryParticipantDto]>;
  findOne: jest.Mock<Promise<ParticipantResponse>, [string, string]>;
  update: jest.Mock<
    Promise<ParticipantResponse>,
    [string, string, UpdateParticipantDto]
  >;
  remove: jest.Mock<Promise<void>, [string, string]>;
}

describe("ParticipantController (unit)", () => {
  let controller: ParticipantController;
  let service: ParticipantServiceMock;

  const eventUuid = "11111111-1111-1111-1111-111111111111";
  const participantUuid = "22222222-2222-2222-2222-222222222222";

  beforeEach(async () => {
    const mockService: ParticipantServiceMock = {
      create: jest.fn<
        Promise<ParticipantResponse>,
        [string, CreateParticipantDto]
      >(),
      findAll: jest.fn<
        Promise<FindAllResponse>,
        [string, QueryParticipantDto]
      >(),
      findOne: jest.fn<Promise<ParticipantResponse>, [string, string]>(),
      update: jest.fn<
        Promise<ParticipantResponse>,
        [string, string, UpdateParticipantDto]
      >(),
      remove: jest.fn<Promise<void>, [string, string]>(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ParticipantController],
      providers: [{ provide: ParticipantService, useValue: mockService }],
    }).compile();

    controller = moduleRef.get(ParticipantController);
    service = moduleRef.get<ParticipantServiceMock>(ParticipantService);
  });

  afterEach(() => jest.resetAllMocks());

  it("POST / → service.create(eventUuid, dto)", async () => {
    const dto: CreateParticipantDto = { email: "john@example.com" };
    const expected: ParticipantResponse = {
      uuid: participantUuid,
      email: dto.email,
    };
    service.create.mockResolvedValue(expected);

    const response = await controller.create(eventUuid, dto);

    expect(service.create).toHaveBeenCalledWith(eventUuid, dto);
    expect(response).toEqual(expected);
  });

  it("GET / → service.findAll(eventUuid, query)", async () => {
    const query = { page: 1, perPage: 10 } as unknown as QueryParticipantDto;
    const expected: FindAllResponse = {
      data: [{ uuid: participantUuid, email: "john@example.com" }],
      metadata: { page: 1, per_page: 10, total: 1, total_pages: 1 },
    };
    service.findAll.mockResolvedValue(expected);

    const response = await controller.findAll(eventUuid, query);

    expect(service.findAll).toHaveBeenCalledWith(eventUuid, query);
    expect(response).toEqual(expected);
  });

  it("GET /:uuid → service.findOne(eventUuid, uuid)", async () => {
    const expected: ParticipantResponse = {
      uuid: participantUuid,
      email: "john@example.com",
    };
    service.findOne.mockResolvedValue(expected);

    const response = await controller.findOne(eventUuid, participantUuid);

    expect(service.findOne).toHaveBeenCalledWith(eventUuid, participantUuid);
    expect(response).toEqual(expected);
  });

  it("PATCH /:uuid → service.update(eventUuid, uuid, dto)", async () => {
    const dto: UpdateParticipantDto = { email: "new@example.com" };
    const expected: ParticipantResponse = {
      uuid: participantUuid,
      email: "new@example.com",
    };
    service.update.mockResolvedValue(expected);

    const response = await controller.update(eventUuid, participantUuid, dto);

    expect(service.update).toHaveBeenCalledWith(
      eventUuid,
      participantUuid,
      dto,
    );
    expect(response).toEqual(expected);
  });

  it("DELETE /:uuid", async () => {
    service.remove.mockResolvedValue();
    await controller.remove(eventUuid, participantUuid);
    expect(service.remove).toHaveBeenCalledWith(eventUuid, participantUuid);
  });
});
