export const AuditAction = {
  EventCreated: "event.created",
  EventUpdated: "event.updated",

  ParticipantRegistered: "participant.registered",
  ParticipantCreated: "participant.created",
  ParticipantImported: "participant.imported",
  ParticipantUpdated: "participant.updated",
  ParticipantDeleted: "participant.deleted",
  ParticipantsImported: "participants.imported",
  ParticipantsExported: "participants.exported",

  AttributeCreated: "attribute.created",
  AttributeUpdated: "attribute.updated",
  AttributeDeleted: "attribute.deleted",

  BlockCreated: "block.created",
  BlockUpdated: "block.updated",
  BlockDeleted: "block.deleted",

  FormCreated: "form.created",
  FormUpdated: "form.updated",
  FormDeleted: "form.deleted",

  EmailTemplateCreated: "email_template.created",
  EmailTemplateUpdated: "email_template.updated",
  EmailTemplateDeleted: "email_template.deleted",
  EmailsQueuedManually: "emails.queued_manually",

  OrganizerAdded: "organizer.added",
  OrganizerPermissionsChanged: "organizer.permissions_changed",
  OrganizerRemoved: "organizer.removed",

  TicketConfigured: "ticket.configured",
  TicketUpdated: "ticket.updated",
  TicketDeleted: "ticket.deleted",
  TicketCheckedIn: "ticket.checked_in",
} as const;

export type AuditActionCode = (typeof AuditAction)[keyof typeof AuditAction];

export const AuditEntityType = {
  Event: "event",
  Participant: "participant",
  Attribute: "attribute",
  Block: "block",
  Form: "form",
  EmailTemplate: "email_template",
  Organizer: "organizer",
  Ticket: "ticket",
} as const;

export type AuditEntityTypeCode =
  (typeof AuditEntityType)[keyof typeof AuditEntityType];
