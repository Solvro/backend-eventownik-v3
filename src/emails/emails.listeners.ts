import { ParticipantRegisteredEvent } from "src/common/events/participant-registered.event";

import { Injectable, NotImplementedException } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { EmailsService } from "./emails.service";

@Injectable()
export class EmailsListeners {
  constructor(private readonly emailsService: EmailsService) {}

  @OnEvent("participant.registered")
  async handleParticipantRegisteredEvent(event: ParticipantRegisteredEvent) {
    throw new NotImplementedException("Not implemented yet");
  }
}
