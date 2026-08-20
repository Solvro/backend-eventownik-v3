import { Queue } from "bullmq";

import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";

import {
  AUTH_EMAIL_JOB_NAME,
  AUTH_EMAIL_QUEUE_NAME,
} from "./auth-email.constants";

export interface AuthEmailJobData {
  to: string;
  name: string;
  resetUrl: string;
}

@Injectable()
export class AuthEmailService {
  constructor(
    @InjectQueue(AUTH_EMAIL_QUEUE_NAME) private readonly emailQueue: Queue,
  ) {}

  async enqueuePasswordResetEmail(
    to: string,
    name: string,
    resetUrl: string,
  ): Promise<void> {
    await this.emailQueue.add(
      AUTH_EMAIL_JOB_NAME,
      {
        to,
        name,
        resetUrl,
      } satisfies AuthEmailJobData,
      {
        attempts: 3,
        backoff: {
          delay: 1000,
          type: "exponential",
        },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }
}
