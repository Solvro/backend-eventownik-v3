import type { Prisma } from "src/generated/prisma/client";

export class AttributeChangedEvent {
  constructor(
    public readonly attributeUuid: string,
    public readonly participantUuid: string,
    public readonly eventUuid: string,
    public readonly newValue: Prisma.JsonValue,
  ) {}
}
