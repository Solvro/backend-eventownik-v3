import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { ParticipantsService } from "./participants.service";
import { PublicParticipantsController } from "./public-participants.controller";

describe("PublicParticipantsController", () => {
  let controller: PublicParticipantsController;

  const mockParticipantsService = {
    findOnePublic: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicParticipantsController],
      providers: [
        {
          provide: ParticipantsService,
          useValue: mockParticipantsService,
        },
      ],
    }).compile();

    controller = module.get<PublicParticipantsController>(
      PublicParticipantsController,
    );
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("findOne", () => {
    it("should return the public participant with listed attributes", async () => {
      const eventUuid = "event-123";
      const participantUuid = "part-123";
      const attributes = ["attr-1", "attr-2"];

      const expectedResult = { uuid: participantUuid };
      mockParticipantsService.findOnePublic.mockResolvedValue(expectedResult);

      const result = await controller.findOne(
        eventUuid,
        participantUuid,
        attributes,
      );

      expect(result).toBe(expectedResult);
      expect(mockParticipantsService.findOnePublic).toHaveBeenCalledWith(
        eventUuid,
        participantUuid,
        attributes,
      );
    });

    it("should pass empty array if no attributes query parameter is provided", async () => {
      const eventUuid = "event-123";
      const participantUuid = "part-123";

      mockParticipantsService.findOnePublic.mockResolvedValue({});

      await controller.findOne(eventUuid, participantUuid);

      expect(mockParticipantsService.findOnePublic).toHaveBeenCalledWith(
        eventUuid,
        participantUuid,
        [],
      );
    });
  });
});
