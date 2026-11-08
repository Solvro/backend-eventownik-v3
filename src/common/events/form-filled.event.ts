export class FormFilledEvent {
  constructor(
    public readonly formUuid: string,
    public readonly participantUuid: string,
    public readonly eventUuid: string,
  ) {}
}
