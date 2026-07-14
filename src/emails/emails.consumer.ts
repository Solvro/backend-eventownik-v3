import { Job } from "bullmq";

import { Processor, WorkerHost } from "@nestjs/bullmq";

import type { EmailSendJobData } from "./email-delivery.service";
import { EmailDeliveryService } from "./email-delivery.service";
import { EMAIL_QUEUE_NAME } from "./emails.constants";

@Processor(EMAIL_QUEUE_NAME)
export class EmailsConsumer extends WorkerHost {
  constructor(private readonly emailDeliveryService: EmailDeliveryService) {
    super();
  }

  async process(job: Job<EmailSendJobData>): Promise<void> {
    await this.emailDeliveryService.deliverEmailToParticipants(
      job.data.emailUuid,
      job.data.participantUuid,
      job.data.statusUuid,
      job.data.participantSnapshot,
    );
  }
}
