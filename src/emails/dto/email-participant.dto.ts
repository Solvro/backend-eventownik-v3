import type { EmailStatus } from "src/generated/prisma/enums";

export class EmailParticipantDto {
  id?: string;
  email?: string;
  createdAt?: string;
  updatedAt?: string;
  status: EmailStatus;
  sendAt: string;
  sendBy: string | null;
}
