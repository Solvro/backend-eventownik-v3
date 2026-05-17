export class AttributeChangedEvent {
  constructor(
    public readonly attributeUuid: string,
    public readonly participantUuid: string,
    public readonly eventUuid: string,
    public readonly newValue: any,
  ) {}
}
