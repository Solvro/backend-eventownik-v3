import { Job } from "bullmq";

import { Processor, WorkerHost } from "@nestjs/bullmq";

@Processor("automatic-emails")
export class EmailsConsumer extends WorkerHost {
  async process(job: Job): Promise<void> {
    await job.data; // just for testing purposes, TODO: implement actual email sending logic here
  }
}
