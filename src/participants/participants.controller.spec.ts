import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import type { ParticipantCreateDto } from "./dto/participant-create.dto";
import { ParticipantListingDto } from "./dto/participant-listing.dto";
import type { ParticipantUpdateDto } from "./dto/participant-update.dto";
import type { UnregisterManyDto } from "./dto/unregister-many.dto";
import { ParticipantsController } from "./participants.controller";
import { ParticipantsService } from "./participants.service";

describe("ParticipantsController", () => {
  let controller: ParticipantsController;

  const mockParticipantsService = {
    findAll: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    removeMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParticipantsController],
      providers: [
        {
          provide: ParticipantsService,
          useValue: mockParticipantsService,
        },
      ],
    }).compile();

    controller = module.get<ParticipantsController>(ParticipantsController);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("findAll", () => {
    it("should return a list of participants", async () => {
      const eventUuid = "event-123";
      const query = new ParticipantListingDto();
      const expectedResult = { data: [], meta: { itemCount: 0 } };

      mockParticipantsService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(eventUuid, query);

      expect(result).toBe(expectedResult);
      expect(mockParticipantsService.findAll).toHaveBeenCalledWith(
        eventUuid,
        query,
      );
    });
  });

  describe("create", () => {
    it("should create and return a participant", async () => {
      const eventUuid = "event-123";
      const dto: ParticipantCreateDto = {
        email: "test@test.com",
        participantAttributes: [],
      };
      const expectedResult = { uuid: "part-123", email: "test@test.com" };

      mockParticipantsService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(eventUuid, dto);

      expect(result).toBe(expectedResult);
      expect(mockParticipantsService.create).toHaveBeenCalledWith(
        eventUuid,
        dto,
      );
    });
  });

  describe("findOne", () => {
    it("should return a specific participant", async () => {
      const eventUuid = "event-123";
      const participantUuid = "part-123";
      const expectedResult = { uuid: participantUuid };

      mockParticipantsService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(eventUuid, participantUuid);

      expect(result).toBe(expectedResult);
      expect(mockParticipantsService.findOne).toHaveBeenCalledWith(
        eventUuid,
        participantUuid,
      );
    });
  });

  describe("update", () => {
    it("should update and return a participant", async () => {
      const eventUuid = "event-123";
      const participantUuid = "part-123";
      const dto: ParticipantUpdateDto = { email: "updated@test.com" };
      const expectedResult = {
        uuid: participantUuid,
        email: "updated@test.com",
      };

      mockParticipantsService.update.mockResolvedValue(expectedResult);

      const result = await controller.update(eventUuid, participantUuid, dto);

      expect(result).toBe(expectedResult);
      expect(mockParticipantsService.update).toHaveBeenCalledWith(
        eventUuid,
        participantUuid,
        dto,
      );
    });
  });

  describe("remove/unregister", () => {
    it("should delete a participant", async () => {
      const eventUuid = "event-123";
      const participantUuid = "part-123";

      mockParticipantsService.remove.mockResolvedValue(null);

      await controller.remove(eventUuid, participantUuid);

      expect(mockParticipantsService.remove).toHaveBeenCalledWith(
        eventUuid,
        participantUuid,
      );

      // Testing unregister alias
      await controller.unregister(eventUuid, participantUuid);
      expect(mockParticipantsService.remove).toHaveBeenCalledTimes(2);
    });
  });

  describe("unregisterMany", () => {
    it("should unregister many participants", async () => {
      const eventUuid = "event-123";
      const dto: UnregisterManyDto = {
        participantsToUnregisterIds: ["p-1", "p-2"],
      };

      mockParticipantsService.removeMany.mockResolvedValue(null);

      await controller.unregisterMany(eventUuid, dto);

      expect(mockParticipantsService.removeMany).toHaveBeenCalledWith(
        eventUuid,
        dto.participantsToUnregisterIds,
      );
    });
  });
});
