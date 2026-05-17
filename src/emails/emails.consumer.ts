import { Job } from "bullmq";

import { Processor, WorkerHost } from "@nestjs/bullmq";

import type { EmailSendJobData } from "./emails.service";
import { EmailsService } from "./emails.service";

@Processor("automatic-emails")
export class EmailsConsumer extends WorkerHost {
  constructor(private readonly emailsService: EmailsService) {
    super();
  }

  async process(job: Job<EmailSendJobData>): Promise<void> {
    await this.emailsService.deliverEmailToParticipants(
      job.data.emailUuid,
      job.data.participantUuids,
    );
  }
}
