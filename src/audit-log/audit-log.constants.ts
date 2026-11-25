export const AuditAction = {
  EventCreated: "event.created",
  EventUpdated: "event.updated",
  EventRegisterFormChanged: "event.register_form_changed",
  EventLinkCreated: "event.link_created",
  EventLinkUpdated: "event.link_updated",
  EventLinkDeleted: "event.link_deleted",

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
  AttributesReordered: "attributes.reordered",

  BlockCreated: "block.created",
  BlockUpdated: "block.updated",
  BlockDeleted: "block.deleted",
  BlocksReordered: "blocks.reordered",

  FormCreated: "form.created",
  FormUpdated: "form.updated",
  FormDeleted: "form.deleted",
  FormsReordered: "forms.reordered",

  EmailTemplateCreated: "email_template.created",
  EmailTemplateUpdated: "email_template.updated",
  EmailTemplateDeleted: "email_template.deleted",
  EmailsSentManually: "emails.sent_manually",

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
  EventLink: "event_link",
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
