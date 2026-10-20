import type { EmailStatus } from "src/generated/prisma/enums";

import { EmailAttachmentDto } from "./email-attachment.dto";
import { EmailElementDto } from "./email-element.dto";

export class EmailCompleteElementDto extends EmailElementDto {
  content: string;
  order: number | null;
  attachments: EmailAttachmentDto[];
  participants: EmailParticipant[];
}

class EmailParticipant {
  id?: string;
  email?: string;
  createdAt?: string;
  updatedAt?: string;
  status: EmailStatus;
  sendAt: string;
  sendBy: string | null;
}
