import { PrismaService } from "src/prisma/prisma.service";
import { StorageService } from "src/storage/storage.service";

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";

@Injectable()
export class FormsReaperService {
  private readonly logger = new Logger(FormsReaperService.name);
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    configService: ConfigService,
  ) {
    this.bucket = configService.getOrThrow<string>("S3_BUCKET_FORMS");
  }

  @Cron(CronExpression.EVERY_HOUR)
  async reapExpiredFiles(): Promise<void> {
    const ttlHours = await this.prisma.$queryRawUnsafe<{ ttl_hours: number }[]>(
      `SELECT COALESCE(
        (current_setting('UPLOAD_TTL_HOURS')::integer),
        24
      ) as ttl_hours`,
    );

    const ttl = ttlHours?.[0]?.ttl_hours ?? 24;
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() - ttl);

    try {
      const expiredFiles = await this.prisma.uploadedFile.findMany({
        where: {
          claimedAt: null,
          createdAt: {
            lt: expiryDate,
          },
        },
      });

      if (expiredFiles.length === 0) {
        this.logger.debug("No expired files to reap");
        return;
      }

      this.logger.log(`Found ${expiredFiles.length} expired files to reap`);

      await Promise.all(
        expiredFiles.map(async (file) => {
          try {
            await this.storageService.delete(this.bucket, file.fileKey);
          } catch (error) {
            this.logger.warn(
              `Failed to delete S3 object ${file.fileKey}: ${error}`,
            );
          }
        }),
      );

      await this.prisma.uploadedFile.deleteMany({
        where: {
          uuid: {
            in: expiredFiles.map((f) => f.uuid),
          },
        },
      });

      this.logger.log(
        `Successfully reaped ${expiredFiles.length} expired files`,
      );
    } catch (error) {
      this.logger.error(`Error during reaping: ${error}`);
    }
  }
}
