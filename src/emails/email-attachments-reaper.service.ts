import { PrismaService } from "src/prisma/prisma.service";
import { StorageService } from "src/storage/storage.service";

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";

@Injectable()
export class EmailAttachmentsReaperService {
  private readonly logger = new Logger(EmailAttachmentsReaperService.name);
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {
    this.bucket = configService.getOrThrow<string>(
      "S3_BUCKET_EMAIL_ATTACHMENTS",
    );
  }

  @Cron(CronExpression.EVERY_HOUR)
  async reapExpiredAttachments(): Promise<void> {
    const ttl = this.configService.getOrThrow<number>(
      "EMAIL_ATTACHMENT_TTL_HOURS",
    );
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() - ttl);

    try {
      const expiredAttachments = await this.prisma.emailAttachment.findMany({
        where: {
          claimedAt: null,
          createdAt: {
            lt: expiryDate,
          },
        },
      });

      if (expiredAttachments.length === 0) {
        this.logger.debug("No expired email attachments to reap");
        return;
      }

      this.logger.log(
        `Found ${String(expiredAttachments.length)} expired email attachments to reap`,
      );

      await Promise.all(
        expiredAttachments.map(async (attachment) => {
          try {
            await this.storageService.delete(this.bucket, attachment.fileKey);
          } catch (error) {
            this.logger.warn(
              `Failed to delete S3 object ${attachment.fileKey}: ${String(error)}`,
            );
          }
        }),
      );

      await this.prisma.emailAttachment.deleteMany({
        where: {
          uuid: {
            in: expiredAttachments.map((attachment) => attachment.uuid),
          },
        },
      });

      this.logger.log(
        `Successfully reaped ${String(expiredAttachments.length)} expired email attachments`,
      );
    } catch (error) {
      this.logger.error(
        `Error during email attachment reaping: ${String(error)}`,
      );
    }
  }
}
