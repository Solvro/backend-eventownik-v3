import type { EmailTrigger } from "src/generated/prisma/enums";

export class EmailElementDto {
  id: string;
  eventId: string;
  name: string;
  trigger: EmailTrigger;
  triggerValue: string | null;
  triggerValue2: string | null;
  createdAt: string;
  updatedAt: string;
}
