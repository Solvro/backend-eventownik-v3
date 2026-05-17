import { AttributeChangedEvent } from "src/common/events/attribute-changed.event";
import { FormFilledEvent } from "src/common/events/form-filled.event";
import { ParticipantDeletedEvent } from "src/common/events/participant-deleted.event";
import { ParticipantRegisteredEvent } from "src/common/events/participant-registered.event";
import { EmailTrigger } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { EmailsService } from "./emails.service";

@Injectable()
export class EmailsListeners {
  constructor(
    private readonly emailsService: EmailsService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent("participant.registered")
  async handleParticipantRegisteredEvent(event: ParticipantRegisteredEvent) {
    const templates = await this.prisma.emailTemplate.findMany({
      where: {
        eventUuid: event.eventUuid,
        trigger: EmailTrigger.PARTICIPANT_REGISTERED,
      },
    });

    for (const template of templates) {
      await this.emailsService.sendEmailToParticipants(template.uuid, [
        event.participantUuid,
      ]);
    }
  }

  @OnEvent("participant.deleted")
  async handleParticipantDeletedEvent(event: ParticipantDeletedEvent) {
    const templates = await this.prisma.emailTemplate.findMany({
      where: {
        eventUuid: event.eventUuid,
        trigger: EmailTrigger.PARTICIPANT_DELETED,
      },
    });

    for (const template of templates) {
      await this.emailsService.sendEmailToParticipants(template.uuid, [
        event.participantUuid,
      ]);
    }
  }

  @OnEvent("form.filled")
  async handleFormFilledEvent(event: FormFilledEvent) {
    const templates = await this.prisma.emailTemplate.findMany({
      where: {
        eventUuid: event.eventUuid,
        trigger: EmailTrigger.FORM_FILLED,
      },
    });

    for (const template of templates) {
      const config = template.triggerConfig as any;
      if (config?.formUuid === event.formUuid) {
        await this.emailsService.sendEmailToParticipants(template.uuid, [
          event.participantUuid,
        ]);
      }
    }
  }

  @OnEvent("attribute.changed")
  async handleAttributeChangedEvent(event: AttributeChangedEvent) {
    const templates = await this.prisma.emailTemplate.findMany({
      where: {
        eventUuid: event.eventUuid,
        trigger: EmailTrigger.ATTRIBUTE_CHANGED,
      },
    });

    for (const template of templates) {
      const config = template.triggerConfig as any;
      if (
        config?.attributeUuid === event.attributeUuid &&
        config?.expectedValue === event.newValue
      ) {
        await this.emailsService.sendEmailToParticipants(template.uuid, [
          event.participantUuid,
        ]);
      }
    }
  }
}
