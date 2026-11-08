import { AttributeChangedEvent } from "src/common/events/attribute-changed.event";
import {
  ATTRIBUTE_CHANGED_EVENT,
  FORM_FILLED_EVENT,
  PARTICIPANT_DELETED_EVENT,
  PARTICIPANT_REGISTERED_EVENT,
} from "src/common/events/event-names.constants";
import { FormFilledEvent } from "src/common/events/form-filled.event";
import { ParticipantDeletedEvent } from "src/common/events/participant-deleted.event";
import { ParticipantRegisteredEvent } from "src/common/events/participant-registered.event";
import { getJsonObject } from "src/common/utils/prisma.utility";
import { EmailTrigger } from "src/generated/prisma/enums";
import { PrismaService } from "src/prisma/prisma.service";

import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { EmailDeliveryService } from "./email-delivery.service";

@Injectable()
export class EmailsListeners {
  constructor(
    private readonly emailDeliveryService: EmailDeliveryService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent(PARTICIPANT_REGISTERED_EVENT)
  async handleParticipantRegisteredEvent(event: ParticipantRegisteredEvent) {
    const templates = await this.prisma.emailTemplate.findMany({
      where: {
        eventUuid: event.eventUuid,
        trigger: EmailTrigger.PARTICIPANT_REGISTERED,
      },
    });

    await Promise.all(
      templates.map(async (template) =>
        this.emailDeliveryService.sendEmailToParticipants(template.uuid, [
          event.participantUuid,
        ]),
      ),
    );
  }

  @OnEvent(PARTICIPANT_DELETED_EVENT)
  async handleParticipantDeletedEvent(event: ParticipantDeletedEvent) {
    const templates = await this.prisma.emailTemplate.findMany({
      where: {
        eventUuid: event.eventUuid,
        trigger: EmailTrigger.PARTICIPANT_DELETED,
      },
    });

    await Promise.all(
      templates.map(async (template) =>
        this.emailDeliveryService.sendEmailToParticipants(
          template.uuid,
          [event.participant.uuid],
          event.participant,
        ),
      ),
    );
  }

  @OnEvent(FORM_FILLED_EVENT)
  async handleFormFilledEvent(event: FormFilledEvent) {
    const templates = await this.prisma.emailTemplate.findMany({
      where: {
        eventUuid: event.eventUuid,
        trigger: EmailTrigger.FORM_FILLED,
      },
    });

    await Promise.all(
      templates.map(async (template) => {
        const config = getJsonObject(template.triggerConfig);
        if (config?.formUuid === event.formUuid) {
          return this.emailDeliveryService.sendEmailToParticipants(
            template.uuid,
            [event.participantUuid],
          );
        }
      }),
    );
  }

  @OnEvent(ATTRIBUTE_CHANGED_EVENT)
  async handleAttributeChangedEvent(event: AttributeChangedEvent) {
    const templates = await this.prisma.emailTemplate.findMany({
      where: {
        eventUuid: event.eventUuid,
        trigger: EmailTrigger.ATTRIBUTE_CHANGED,
      },
    });

    await Promise.all(
      templates.map(async (template) => {
        const config = getJsonObject(template.triggerConfig);
        if (
          config?.attributeUuid === event.attributeUuid &&
          JSON.stringify(config.expectedValue) ===
            JSON.stringify(event.newValue)
        ) {
          return this.emailDeliveryService.sendEmailToParticipants(
            template.uuid,
            [event.participantUuid],
          );
        }
      }),
    );
  }
}
