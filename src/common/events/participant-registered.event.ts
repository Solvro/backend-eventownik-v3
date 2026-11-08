export class ParticipantRegisteredEvent {
  constructor(
    public readonly participantUuid: string,
    public readonly eventUuid: string,
  ) {}
}
