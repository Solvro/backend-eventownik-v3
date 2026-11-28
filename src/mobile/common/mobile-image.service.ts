import { randomUUID } from "node:crypto";
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

export const MOBILE_AUDIO_MAX_BYTES = 3 * 1024 * 1024;

/** Detects the formats browsers record or play (MP4/M4A, WebM, Ogg, WAV, MP3, AAC) by magic bytes. */
function detectAudioType(
  buffer: Buffer,
): { mime: string; extension: string } | undefined {
  if (buffer.length < 12) {
    return undefined;
  }
  if (buffer.toString("latin1", 4, 8) === "ftyp") {
    return { mime: "audio/mp4", extension: "m4a" };
  }
  if (buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return { mime: "audio/webm", extension: "webm" };
  }
  if (buffer.toString("latin1", 0, 4) === "OggS") {
    return { mime: "audio/ogg", extension: "ogg" };
  }
  if (
    buffer.toString("latin1", 0, 4) === "RIFF" &&
    buffer.toString("latin1", 8, 12) === "WAVE"
  ) {
    return { mime: "audio/wav", extension: "wav" };
  }
  if (buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0) {
    return { mime: "audio/aac", extension: "aac" };
  }
  if (
    buffer.toString("latin1", 0, 3) === "ID3" ||
    (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
  ) {
    return { mime: "audio/mpeg", extension: "mp3" };
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

    // The bucket is publicly readable, so the key is the only thing protecting a photo
    return this.storageService.upload(
      this.bucket,
      {
        ...file,
        originalname: `mobile.${detected.extension}`,
        mimetype: detected.mime,
      },
      `mobile-${randomUUID()}.${detected.extension}`,
    );
  }

  /**
   * Like upload, for a sound: validated by magic bytes, max 3 MB. Returns the
   * storage key and the detected type, which players need to pick a decoder.
   */
  async uploadAudio(
    file: Express.Multer.File | undefined,
  ): Promise<{ key: string; mime: string }> {
    if (file?.buffer === undefined || file.buffer.length === 0) {
      throw new BadRequestException("Audio file is required");
    }
    if (file.buffer.length > MOBILE_AUDIO_MAX_BYTES) {
      throw new PayloadTooLargeException("Audio is larger than 3 MB");
    }
    const detected = detectAudioType(file.buffer);
    if (detected === undefined) {
      throw new BadRequestException("Unsupported audio format");
    }
    const key = await this.storageService.upload(
      this.bucket,
      {
        ...file,
        originalname: `mobile.${detected.extension}`,
        mimetype: detected.mime,
      },
      `mobile-${randomUUID()}.${detected.extension}`,
    );
    return { key, mime: detected.mime };
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
