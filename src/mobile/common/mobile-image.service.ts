import { StorageService } from "src/storage/storage.service";

import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export const MOBILE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Detects JPEG/PNG/WebP by magic bytes. (`file-type` is ESM-only and cannot be
 * imported from this CommonJS build, and these three signatures are trivial.)
 */
function detectImageType(
  buffer: Buffer,
): { mime: string; extension: string } | undefined {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mime: "image/png", extension: "png" };
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("latin1", 0, 4) === "RIFF" &&
    buffer.toString("latin1", 8, 12) === "WEBP"
  ) {
    return { mime: "image/webp", extension: "webp" };
  }
  return undefined;
}

/** Public URL of an image stored by MobileImageService (same layout as StorageService.getUrl). */
export function mobileImageUrl(key: string | null | undefined): string | null {
  if (key === null || key === undefined || key === "") {
    return null;
  }
  return `${process.env.S3_PUBLIC_URL ?? ""}/${process.env.S3_BUCKET_EVENTS ?? ""}/${key}`;
}

@Injectable()
export class MobileImageService {
  private readonly bucket: string;

  constructor(
    private readonly storageService: StorageService,
    configService: ConfigService,
  ) {
    this.bucket = configService.getOrThrow<string>("S3_BUCKET_EVENTS");
  }

  /**
   * Validates the image by its magic bytes (JPEG/PNG/WebP, max 8 MB) and stores it.
   * The client-supplied name and mimetype are ignored. Returns the storage key.
   */
  async upload(file: Express.Multer.File | undefined): Promise<string> {
    if (file?.buffer === undefined || file.buffer.length === 0) {
      throw new BadRequestException("Image file is required");
    }
    if (file.buffer.length > MOBILE_IMAGE_MAX_BYTES) {
      throw new PayloadTooLargeException("Image is larger than 8 MB");
    }

    const detected = detectImageType(file.buffer);
    if (detected === undefined) {
      throw new BadRequestException(
        "Only JPEG, PNG and WebP images are allowed",
      );
    }

    return this.storageService.upload(this.bucket, {
      ...file,
      originalname: `mobile.${detected.extension}`,
      mimetype: detected.mime,
    });
  }

  url(key: string | null | undefined): string | null {
    return key === null || key === undefined || key === ""
      ? null
      : this.storageService.getUrl(this.bucket, key);
  }

  async delete(key: string | null | undefined): Promise<void> {
    if (key === null || key === undefined || key === "") {
      return;
    }
    await this.storageService.delete(this.bucket, key);
  }
}
