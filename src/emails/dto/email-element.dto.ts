import type { EmailTrigger } from "src/generated/prisma/enums";

export class EmailElementDto {
  id: string;
  eventId: string;
  name: string;
  trigger: EmailTrigger;
  triggerConfig: any;
  createdAt: string;
  updatedAt: string;
}
