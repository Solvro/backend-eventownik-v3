import type { EmailStatus } from "src/generated/prisma/enums";

import { EmailElementDto } from "./email-element.dto";

export class EmailCompleteElementDto extends EmailElementDto {
  content: string;
  order: number | null;
  participants: EmailParticipant[];
}

class EmailParticipant {
  id?: string;
  email?: string;
  createdAt?: string;
  updatedAt?: string;
  meta: {
    pivot_status: EmailStatus;
    pivot_send_at: string;
    pivot_send_by: string | null;
  };
}
