import type { Prisma } from "src/generated/prisma/client";

import type { EmailAttachmentDto } from "./email-attachment.dto";

export class EmailResponseDto {
  id: string;
  name: string;
  content: string;
  trigger: string;
  triggerConfig: Prisma.JsonValue | null;
  order: number | null;
  eventId: string;
  schema?: Prisma.JsonValue | null;
  createdAt: string;
  updatedAt: string;
  attachments: EmailAttachmentDto[];
}
