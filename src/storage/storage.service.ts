import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
// eslint-disable-next-line unicorn/import-style
import { extname } from "node:path";

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly publicUrl: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly configService: ConfigService) {
    this.client = new S3Client({
      endpoint: this.configService.getOrThrow<string>("S3_ENDPOINT"),
      region: "auto",
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>("S3_ACCESS_KEY"),
        secretAccessKey: this.configService.getOrThrow<string>("S3_SECRET_KEY"),
      },
    });
    this.publicUrl = this.configService.getOrThrow<string>("S3_PUBLIC_URL");
  }

  async upload(bucket: string, file: Express.Multer.File): Promise<string> {
    const extension = extname(file.originalname);
    const key = `${String(Date.now())}-${String(Math.round(Math.random() * 1e9))}${extension}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return `${this.publicUrl}/${bucket}/${key}`;
  }

  async delete(bucket: string, url: string): Promise<void> {
    const key = url.replace(`${this.publicUrl}/${bucket}/`, "");

    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete object ${key} from bucket ${bucket}: ${String(error)}`,
      );
    }
  }
}
