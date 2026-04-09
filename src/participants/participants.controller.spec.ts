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
    createParticipant: jest.fn(),
    findOne: jest.fn(),
    updateParticipant: jest.fn(),
    unregister: jest.fn(),
    unregisterMany: jest.fn(),
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

  describe("index", () => {
    it("should return a list of participants", async () => {
      const eventUuid = "event-123";
      const query = new ParticipantListingDto();
      const expectedResult = { data: [], meta: { itemCount: 0 } };

      mockParticipantsService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.index(eventUuid, query);

      expect(result).toBe(expectedResult);
      expect(mockParticipantsService.findAll).toHaveBeenCalledWith(
        eventUuid,
        query,
      );
    });
  });

  describe("store", () => {
    it("should create and return a participant", async () => {
      const eventUuid = "event-123";
      const dto: ParticipantCreateDto = {
        email: "test@test.com",
        participantAttributes: [],
      };
      const expectedResult = { uuid: "part-123", email: "test@test.com" };

      mockParticipantsService.createParticipant.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.store(eventUuid, dto);

      expect(result).toBe(expectedResult);
      expect(mockParticipantsService.createParticipant).toHaveBeenCalledWith(
        eventUuid,
        dto,
      );
    });
  });

  describe("show", () => {
    it("should return a specific participant", async () => {
      const eventUuid = "event-123";
      const participantUuid = "part-123";
      const expectedResult = { uuid: participantUuid };

      mockParticipantsService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.show(eventUuid, participantUuid);

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

      mockParticipantsService.updateParticipant.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.update(eventUuid, participantUuid, dto);

      expect(result).toBe(expectedResult);
      expect(mockParticipantsService.updateParticipant).toHaveBeenCalledWith(
        eventUuid,
        participantUuid,
        dto,
      );
    });
  });

  describe("destroy/unregister", () => {
    it("should delete a participant", async () => {
      const eventUuid = "event-123";
      const participantUuid = "part-123";

      mockParticipantsService.unregister.mockResolvedValue(null);

      await controller.destroy(eventUuid, participantUuid);

      expect(mockParticipantsService.unregister).toHaveBeenCalledWith(
        eventUuid,
        participantUuid,
      );

      // Testing unregister alias
      await controller.unregister(eventUuid, participantUuid);
      expect(mockParticipantsService.unregister).toHaveBeenCalledTimes(2);
    });
  });

  describe("unregisterMany", () => {
    it("should unregister many participants", async () => {
      const eventUuid = "event-123";
      const dto: UnregisterManyDto = {
        participantsToUnregisterIds: ["p-1", "p-2"],
      };

      mockParticipantsService.unregisterMany.mockResolvedValue(null);

      await controller.unregisterMany(eventUuid, dto);

      expect(mockParticipantsService.unregisterMany).toHaveBeenCalledWith(
        eventUuid,
        dto.participantsToUnregisterIds,
      );
    });
  });
});
