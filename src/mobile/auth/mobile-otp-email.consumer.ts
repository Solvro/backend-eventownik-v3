import { MailerService } from "@nestjs-modules/mailer";
import { Job } from "bullmq";

import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";

import { MOBILE_OTP_EMAIL_QUEUE_NAME } from "./mobile-otp-email.constants";
import { MobileOtpEmailJobData } from "./mobile-otp-email.service";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderOtpEmail(eventName: string, code: string): string {
  const name = escapeHtml(eventName);
  return `<!DOCTYPE html>
<html lang="pl">
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;">${name}</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Twój kod logowania do aplikacji wydarzenia:</p>
      <p style="margin:0 0 24px;font-size:40px;font-weight:bold;letter-spacing:10px;text-align:center;font-family:'Courier New',Courier,monospace;">${code}</p>
      <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#52525b;">Kod jest ważny przez 10 minut. Nie udostępniaj go nikomu.</p>
      <p style="margin:0;font-size:14px;line-height:1.5;color:#52525b;">Jeśli to nie Ty próbujesz się zalogować, zignoruj tę wiadomość.</p>
    </div>
    <p style="max-width:480px;margin:16px auto 0;font-size:12px;color:#a1a1aa;text-align:center;">Eventownik</p>
  </body>
</html>`;
}

@Processor(MOBILE_OTP_EMAIL_QUEUE_NAME)
export class MobileOtpEmailConsumer extends WorkerHost {
  private readonly logger = new Logger(MobileOtpEmailConsumer.name);

  constructor(private readonly mailerService: MailerService) {
    super();
  }

  async process(job: Job<MobileOtpEmailJobData>): Promise<void> {
    const { to, eventName, code } = job.data;
    try {
      await this.mailerService.sendMail({
        to,
        subject: `${eventName} — kod logowania: ${code}`,
        html: renderOtpEmail(eventName, code),
        text: `Twój kod logowania do aplikacji wydarzenia ${eventName}: ${code}\nKod jest ważny przez 10 minut.`,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send mobile OTP email to ${to}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
