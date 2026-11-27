import type { CanActivate, ExecutionContext } from "@nestjs/common";
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

import { MobileEventService } from "../common/mobile-event.service";
import type { ParticipantRequest } from "./current-participant.decorator";
import { MobileTokenService, emailFingerprint } from "./mobile-token.service";

/**
 * Authenticates a participant of `:eventSlug` from `Authorization: Bearer <participant token>`
 * and sets `request.participant`. The event/app and participant lookups are cached in memory,
 * so polled reads do not hit the database for auth on every request.
 */
@Injectable()
export class ParticipantAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: MobileTokenService,
    private readonly mobileEventService: MobileEventService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ParticipantRequest>();

    const header = request.headers.authorization;
    const [scheme, token] =
      typeof header === "string" ? header.split(" ") : [undefined, undefined];
    if (
      scheme?.toLowerCase() !== "bearer" ||
      token === undefined ||
      token === ""
    ) {
      throw new UnauthorizedException();
    }

    const payload = this.tokenService.verify(token);
    if (payload === null) {
      throw new UnauthorizedException();
    }

    const slug = request.params.eventSlug;
    if (slug === undefined) {
      throw new NotFoundException("Event not found");
    }
    // 404 when the event does not exist or its app is not enabled
    const { event } = await this.mobileEventService.getEnabledBySlug(slug);

    if (payload.eventUuid !== event.uuid) {
      throw new UnauthorizedException();
    }

    const participant = await this.mobileEventService.getParticipant(
      payload.sub,
    );
    if (participant?.eventUuid !== event.uuid) {
      throw new UnauthorizedException();
    }
    // The session belongs to whoever owned the email at login, not to the participant row
    if (emailFingerprint(participant.email) !== payload.em) {
      throw new UnauthorizedException();
    }

    request.participant = participant;
    return true;
  }
}
