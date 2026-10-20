import type { Prisma } from "src/generated/prisma/client";

import { EmailAttachmentDto } from "./email-attachment.dto";

export class EmailResponseDto {
  id: string;
  name: string;
  content: string;
  trigger: string;
  eventId: string;
  schema?: Prisma.JsonValue | null;
  createdAt: string;
  updatedAt: string;
  attachments: EmailAttachmentDto[];
}
