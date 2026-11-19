import { OpenCondition } from "src/generated/prisma/enums";

interface OpenableForm {
  uuid: string;
  isOpen: boolean;
  openCondition: OpenCondition;
  openDate: Date | null;
  closeDate: Date | null;
  closeOnParticipantsLimit: boolean;
}

interface EventParticipantsState {
  registerFormUuid: string | null;
  participantsLimit: number | null;
  participantsCount: number;
}

export function isFormCurrentlyOpen(
  form: OpenableForm,
  event: EventParticipantsState,
  now = new Date(),
): boolean {
  const isLimitReached =
    form.closeOnParticipantsLimit &&
    event.registerFormUuid === form.uuid &&
    event.participantsLimit !== null &&
    event.participantsCount >= event.participantsLimit;
  if (isLimitReached) {
    return false;
  }

  switch (form.openCondition) {
    case OpenCondition.MANUAL: {
      return form.isOpen;
    }
    case OpenCondition.ON_DATE: {
      return (
        form.closeDate !== null &&
        (form.openDate === null || form.openDate <= now) &&
        form.closeDate >= now
      );
    }
  }
}
