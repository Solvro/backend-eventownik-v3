import { assertAllowedMimeWithMagicBytes } from "src/common/utils/detect-file-mime";
import type { EmailAttachment, Prisma } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { StorageService } from "src/storage/storage.service";

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EmailAttachmentDto } from "./dto/email-attachment.dto";
import type { EmailAttachmentUploadResponseDto } from "./dto/email-attachment-upload-response.dto";

@Injectable()
export class EmailAttachmentsService {
  private readonly bucket: string;
  private readonly maxFileSize: number;
  private readonly maxTotalSize: number;
  private readonly maxCount: number;
  private readonly allowedMimes: string[];
  private readonly ttlHours: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {
    this.bucket = configService.getOrThrow<string>(
      "S3_BUCKET_EMAIL_ATTACHMENTS",
    );
    this.maxFileSize = configService.getOrThrow<number>(
      "EMAIL_ATTACHMENT_MAX_FILE_SIZE",
    );
    this.maxTotalSize = configService.getOrThrow<number>(
      "EMAIL_ATTACHMENT_MAX_TOTAL_SIZE",
    );
    this.maxCount = configService.getOrThrow<number>(
      "EMAIL_ATTACHMENT_MAX_COUNT",
    );
    this.allowedMimes = configService
      .getOrThrow<string>("EMAIL_ATTACHMENT_ALLOWED_MIME")
      .split(",")
      .map((mime) => mime.trim())
      .filter((mime) => mime.length > 0);
    this.ttlHours = configService.getOrThrow<number>(
      "EMAIL_ATTACHMENT_TTL_HOURS",
    );
  }

  toDto(attachment: EmailAttachment): EmailAttachmentDto {
    return {
      id: attachment.uuid,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
    };
  }

  async upload(
    eventUuid: string,
    file: Express.Multer.File | undefined,
  ): Promise<EmailAttachmentUploadResponseDto> {
    if (file == null) {
      throw new BadRequestException("File is required");
    }

    const event = await this.prisma.event.findUnique({
      where: { uuid: eventUuid },
      select: { uuid: true },
    });
    if (event == null) {
      throw new NotFoundException(`Event with id: ${eventUuid} not found`);
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum of ${String(this.maxFileSize)} bytes`,
      );
    }

    await assertAllowedMimeWithMagicBytes(file, this.allowedMimes);

    const fileKey = await this.storageService.upload(this.bucket, file);

    const attachment = await this.prisma.emailAttachment.create({
      data: {
        fileKey,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        emailUuid: null,
      },
    });

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.ttlHours);

    return {
      attachmentToken: attachment.uuid,
      expiresAt: expiresAt.getTime(),
    };
  }

  async deleteUnclaimed(
    eventUuid: string,
    attachmentId: string,
  ): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { uuid: eventUuid },
      select: { uuid: true },
    });
    if (event == null) {
      throw new NotFoundException(`Event with id: ${eventUuid} not found`);
    }

    const attachment = await this.prisma.emailAttachment.findUnique({
      where: { uuid: attachmentId },
    });
    if (attachment == null) {
      throw new NotFoundException(
        `Attachment with id: ${attachmentId} not found`,
      );
    }

    if (attachment.claimedAt !== null) {
      throw new BadRequestException(
        "Only unclaimed attachments can be deleted from the staging area",
      );
    }

    await this.storageService.delete(this.bucket, attachment.fileKey);
    await this.prisma.emailAttachment.delete({
      where: { uuid: attachmentId },
    });
  }

  async listForEmail(
    emailUuid: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<EmailAttachment[]> {
    return tx.emailAttachment.findMany({
      where: { emailUuid },
      orderBy: { createdAt: "asc" },
    });
  }

  async claimForCreate(
    emailUuid: string,
    attachmentIds: string[] | undefined,
    tx: Prisma.TransactionClient,
  ): Promise<EmailAttachment[]> {
    if (attachmentIds == null || attachmentIds.length === 0) {
      return [];
    }

    const uniqueIds = [...new Set(attachmentIds)];
    if (uniqueIds.length !== attachmentIds.length) {
      throw new BadRequestException("Duplicate attachment IDs are not allowed");
    }

    const attachments = await this.resolveClaimableAttachments(
      uniqueIds,
      null,
      tx,
    );
    this.assertWithinLimits(attachments);

    const now = new Date();
    await tx.emailAttachment.updateMany({
      where: { uuid: { in: uniqueIds } },
      data: { emailUuid, claimedAt: now },
    });

    return attachments.map((attachment) => ({
      ...attachment,
      emailUuid,
      claimedAt: now,
    }));
  }

  async syncForUpdate(
    emailUuid: string,
    attachmentIds: string[] | undefined,
    tx: Prisma.TransactionClient,
  ): Promise<EmailAttachment[]> {
    if (attachmentIds === undefined) {
      return this.listForEmail(emailUuid, tx);
    }

    const uniqueIds = [...new Set(attachmentIds)];
    if (uniqueIds.length !== attachmentIds.length) {
      throw new BadRequestException("Duplicate attachment IDs are not allowed");
    }

    const current = await this.listForEmail(emailUuid, tx);
    const nextIds = new Set(uniqueIds);
    const toRemove = current.filter(
      (attachment) => !nextIds.has(attachment.uuid),
    );

    if (toRemove.length > 0) {
      await Promise.all(
        toRemove.map(async (attachment) =>
          this.storageService.delete(this.bucket, attachment.fileKey),
        ),
      );
      await tx.emailAttachment.deleteMany({
        where: { uuid: { in: toRemove.map((attachment) => attachment.uuid) } },
      });
    }

    if (uniqueIds.length === 0) {
      return [];
    }

    const attachments = await this.resolveClaimableAttachments(
      uniqueIds,
      emailUuid,
      tx,
    );
    this.assertWithinLimits(attachments);

    const now = new Date();
    const toClaim = attachments.filter(
      (attachment) => attachment.claimedAt === null,
    );
    if (toClaim.length > 0) {
      await tx.emailAttachment.updateMany({
        where: { uuid: { in: toClaim.map((attachment) => attachment.uuid) } },
        data: { emailUuid, claimedAt: now },
      });
    }

    return attachments.map((attachment) =>
      attachment.claimedAt === null
        ? { ...attachment, emailUuid, claimedAt: now }
        : attachment,
    );
  }

  async duplicateForEmail(
    sourceEmailUuid: string,
    targetEmailUuid: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const sourceAttachments = await this.listForEmail(sourceEmailUuid, tx);
    if (sourceAttachments.length === 0) {
      return;
    }

    for (const source of sourceAttachments) {
      const buffer = await this.storageService.download(
        this.bucket,
        source.fileKey,
      );
      const newFileKey = await this.storageService.uploadBuffer(
        this.bucket,
        buffer,
        source.originalName,
        source.mimeType,
      );

      await tx.emailAttachment.create({
        data: {
          fileKey: newFileKey,
          originalName: source.originalName,
          mimeType: source.mimeType,
          size: source.size,
          emailUuid: targetEmailUuid,
          claimedAt: new Date(),
        },
      });
    }
  }

  async deleteStorageForEmail(emailUuid: string): Promise<void> {
    const attachments = await this.listForEmail(emailUuid);
    await Promise.all(
      attachments.map(async (attachment) =>
        this.storageService.delete(this.bucket, attachment.fileKey),
      ),
    );
  }

  async getNodemailerAttachments(emailUuid: string): Promise<
    {
      filename: string;
      content: Buffer;
      contentType: string;
    }[]
  > {
    const attachments = await this.listForEmail(emailUuid);
    return Promise.all(
      attachments.map(async (attachment) => {
        const content = await this.storageService.download(
          this.bucket,
          attachment.fileKey,
        );
        return {
          filename: attachment.originalName,
          content,
          contentType: attachment.mimeType,
        };
      }),
    );
  }

  private async resolveClaimableAttachments(
    attachmentIds: string[],
    emailUuid: string | null,
    tx: Prisma.TransactionClient,
  ): Promise<EmailAttachment[]> {
    if (attachmentIds.length > this.maxCount) {
      throw new BadRequestException(
        `A maximum of ${String(this.maxCount)} attachments is allowed`,
      );
    }

    const attachments = await tx.emailAttachment.findMany({
      where: { uuid: { in: attachmentIds } },
    });

    if (attachments.length !== attachmentIds.length) {
      throw new BadRequestException(
        "One or more attachment IDs were not found",
      );
    }

    for (const attachment of attachments) {
      const isUnclaimed =
        attachment.claimedAt === null && attachment.emailUuid === null;
      const belongsToThisEmail =
        emailUuid != null &&
        attachment.emailUuid === emailUuid &&
        attachment.claimedAt !== null;

      if (!isUnclaimed && !belongsToThisEmail) {
        throw new BadRequestException(
          `Attachment ${attachment.uuid} is invalid or already claimed`,
        );
      }
    }

    return attachments;
  }

  private assertWithinLimits(attachments: EmailAttachment[]): void {
    if (attachments.length > this.maxCount) {
      throw new BadRequestException(
        `A maximum of ${String(this.maxCount)} attachments is allowed`,
      );
    }

    const totalSize = attachments.reduce(
      (sum, attachment) => sum + attachment.size,
      0,
    );
    if (totalSize > this.maxTotalSize) {
      throw new BadRequestException(
        `Total attachment size exceeds maximum of ${String(this.maxTotalSize)} bytes`,
      );
    }
  }
}
