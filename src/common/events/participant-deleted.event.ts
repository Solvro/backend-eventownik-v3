import type { Prisma } from "src/generated/prisma/client";

export interface DeletedParticipantSnapshot {
  uuid: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  attributes: {
    attributeUuid: string;
    value: Prisma.JsonValue | null;
  }[];
}

export class ParticipantDeletedEvent {
  constructor(
    public readonly participant: DeletedParticipantSnapshot,
    public readonly eventUuid: string,
  ) {}
}
