import { MailerService } from "@nestjs-modules/mailer";
import { Job } from "bullmq";

import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";

import { AUTH_EMAIL_QUEUE_NAME } from "./auth-email.constants";
import { AuthEmailJobData } from "./auth-email.service";

@Processor(AUTH_EMAIL_QUEUE_NAME)
export class AuthEmailConsumer extends WorkerHost {
  private readonly logger = new Logger(AuthEmailConsumer.name);

  constructor(private readonly mailerService: MailerService) {
    super();
  }

  async process(job: Job<AuthEmailJobData>): Promise<void> {
    const { to, name, resetUrl } = job.data;
    try {
      await this.mailerService.sendMail({
        to,
        subject: "Eventownik — Reset hasła",
        template: "password-reset",
        context: { name, resetUrl },
      });
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${to}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
