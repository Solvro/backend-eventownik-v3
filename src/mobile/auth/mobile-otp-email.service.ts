import { Queue } from "bullmq";

import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";

import {
  MOBILE_OTP_EMAIL_JOB_NAME,
  MOBILE_OTP_EMAIL_QUEUE_NAME,
} from "./mobile-otp-email.constants";

export interface MobileOtpEmailJobData {
  to: string;
  eventName: string;
  code: string;
}

@Injectable()
export class MobileOtpEmailService {
  constructor(
    @InjectQueue(MOBILE_OTP_EMAIL_QUEUE_NAME)
    private readonly emailQueue: Queue,
  ) {}

  async enqueueOtpEmail(
    to: string,
    eventName: string,
    code: string,
  ): Promise<void> {
    await this.emailQueue.add(
      MOBILE_OTP_EMAIL_JOB_NAME,
      { to, eventName, code } satisfies MobileOtpEmailJobData,
      {
        attempts: 3,
        backoff: { delay: 1000, type: "exponential" },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }
}
