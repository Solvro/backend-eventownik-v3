export class EmailAttachmentUploadResponseDto {
  /**
   * UUID token used as attachmentId when creating/updating a template.
   */
  attachmentToken: string;

  /**
   * Unix timestamp (ms) when the unclaimed upload expires.
   */
  expiresAt: number;
}
