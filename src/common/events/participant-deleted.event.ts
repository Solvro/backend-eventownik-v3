export class ParticipantDeletedEvent {
  constructor(
    public readonly participantUuid: string,
    public readonly eventUuid: string,
  ) {}
}
