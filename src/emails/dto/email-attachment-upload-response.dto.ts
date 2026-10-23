import { ApiProperty } from "@nestjs/swagger";

export class EmailAttachmentUploadResponseDto {
  @ApiProperty({
    description:
      "UUID token used as attachmentId when creating/updating a template",
  })
  attachmentToken: string;

  @ApiProperty({
    description: "Unix timestamp (ms) when the unclaimed upload expires",
  })
  expiresAt: number;
}
