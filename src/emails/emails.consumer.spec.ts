import type { Job } from "bullmq";

import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";

import type { EmailSendJobData } from "./email-delivery.service";
import { EmailDeliveryService } from "./email-delivery.service";
import { EmailsConsumer } from "./emails.consumer";

describe("EmailsConsumer", () => {
  let consumer: EmailsConsumer;

  const mockEmailDeliveryService = {
    deliverEmailToParticipants: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailsConsumer,
        {
          provide: EmailDeliveryService,
          useValue: mockEmailDeliveryService,
        },
      ],
    }).compile();

    consumer = module.get<EmailsConsumer>(EmailsConsumer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("passes the job data straight through when there is no participant snapshot", async () => {
    const job = {
      data: {
        emailUuid: "email-uuid",
        participantUuid: "participant-uuid",
        statusUuid: "status-uuid",
      } satisfies EmailSendJobData,
    } as unknown as Job<EmailSendJobData>;

    await consumer.process(job);

    expect(
      mockEmailDeliveryService.deliverEmailToParticipants,
    ).toHaveBeenCalledWith(
      "email-uuid",
      "participant-uuid",
      "status-uuid",
      undefined,
    );
  });

  it("rehydrates snapshot createdAt/updatedAt into real Date instances, as they arrive as strings after a BullMQ/Redis JSON round-trip", async () => {
    const job = {
      data: {
        emailUuid: "email-uuid",
        participantUuid: "participant-uuid",
        statusUuid: "status-uuid",
        participantSnapshot: {
          uuid: "participant-uuid",
          email: "deleted@example.com",
          // Simulates what actually comes back out of Redis: real Date
          // objects don't survive JSON.stringify/JSON.parse.
          createdAt: "2025-01-01T00:00:00.000Z" as unknown as Date,
          updatedAt: "2025-01-02T00:00:00.000Z" as unknown as Date,
          attributes: [],
        },
      } satisfies EmailSendJobData,
    } as unknown as Job<EmailSendJobData>;

    await consumer.process(job);

    expect(
      mockEmailDeliveryService.deliverEmailToParticipants,
    ).toHaveBeenCalledTimes(1);
    const call = mockEmailDeliveryService.deliverEmailToParticipants.mock
      .calls[0] as [
      string,
      string,
      string,
      { createdAt: Date; updatedAt: Date },
    ];
    const snapshot = call[3];
    expect(snapshot.createdAt).toBeInstanceOf(Date);
    expect(snapshot.createdAt.toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect(snapshot.updatedAt).toBeInstanceOf(Date);
    expect(snapshot.updatedAt.toISOString()).toBe("2025-01-02T00:00:00.000Z");
  });
});
