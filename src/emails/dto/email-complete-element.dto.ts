import type { EmailStatus } from "src/generated/prisma/enums";

import { EmailElementDto } from "./email-element.dto";

export class EmailCompleteElementDto extends EmailElementDto {
  content: string;
  order: number | null;
  participants: EmailParticipantDto[];
}

export class EmailParticipantDto {
  id?: string;
  email?: string;
  createdAt?: string;
  updatedAt?: string;
  status: EmailStatus;
  sendAt: string;
  sendBy: string | null;
}
