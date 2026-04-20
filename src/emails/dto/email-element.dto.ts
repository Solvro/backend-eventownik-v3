import type { EmailTrigger } from "src/generated/prisma/enums";

export class EmailElementDto {
  id: string;
  eventId: string;
  name: string;
  trigger: EmailTrigger;
  triggerValue: string;
  triggerValue2: string;
  createdAt: string;
  updatedAt: string;
}
