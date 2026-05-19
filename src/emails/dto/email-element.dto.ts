import type { Prisma } from "src/generated/prisma/client";
import type { EmailTrigger } from "src/generated/prisma/enums";

export class EmailElementDto {
  id: string;
  eventId: string;
  name: string;
  trigger: EmailTrigger;
  triggerConfig: Prisma.JsonValue | null;
  schema?: Prisma.JsonValue | null;
  createdAt: string;
  updatedAt: string;
}
