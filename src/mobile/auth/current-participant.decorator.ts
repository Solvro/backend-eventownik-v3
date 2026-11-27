import type { ExecutionContext } from "@nestjs/common";
import { createParamDecorator } from "@nestjs/common";

export interface ParticipantContext {
  uuid: string;
  eventUuid: string;
  email: string;
}

export interface ParticipantRequest {
  headers: Record<string, string | string[] | undefined>;
  params: Record<string, string | undefined>;
  participant?: ParticipantContext;
}

/** The participant resolved by `ParticipantAuthGuard`. */
export const CurrentParticipant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ParticipantContext => {
    const request = context.switchToHttp().getRequest<ParticipantRequest>();
    if (request.participant === undefined) {
      throw new Error("CurrentParticipant used without ParticipantAuthGuard");
    }
    return request.participant;
  },
);
