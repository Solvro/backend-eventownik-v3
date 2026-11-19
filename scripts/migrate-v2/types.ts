export interface V2Admin {
  id: number;
  first_name: string;
  last_name: string;
  password: string;
  email: string;
  type: string;
  active: boolean;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface V2Permission {
  id: number;
  action: string;
  subject: string;
}

export interface V2AdminPermission {
  id: number;
  event_id: number;
  permission_id: number;
  admin_id: number;
}

export interface V2Event {
  id: number;
  organizer_id: number | null;
  name: string;
  description: string | null;
  slug: string;
  start_date: Date;
  end_date: Date;
  lat: number | null;
  long: number | null;
  primary_color: string | null;
  organizer: string | null;
  participants_count: number | null;
  photo_url: string | null;
  social_media_links: string[] | null;
  terms_link: string | null;
  location: string | null;
  contact_email: string | null;
  is_active: boolean | null;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface V2Attribute {
  id: number;
  name: string | null;
  slug: string | null;
  event_id: number;
  show_in_list: boolean | null;
  options: unknown;
  type: string;
  order: number;
  is_sensitive_data: boolean | null;
  reason: string | null;
  allow_other: boolean;
  is_multiple: boolean;
  max_selections: number | null;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface V2Block {
  id: number;
  name: string | null;
  description: string | null;
  capacity: number | null;
  parent_id: number | null;
  attribute_id: number | null;
  is_root_block: boolean;
  order: number;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface V2Form {
  id: number;
  name: string;
  slug: string;
  start_date: Date | null;
  end_date: Date | null;
  is_open: boolean | null;
  is_first_form: boolean | null;
  description: string | null;
  event_id: number | null;
  submissions_left: number | null;
  order: number;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface V2FormDefinition {
  id: number;
  attribute_id: number | null;
  form_id: number | null;
  is_editable: boolean;
  is_required: boolean;
  order: number | null;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface V2Email {
  id: number;
  event_id: number | null;
  name: string;
  content: string;
  trigger: string;
  trigger_value: string | null;
  trigger_value_2: string | null;
  form_id: number | null;
  order: number;
  schema: string | null;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface V2Participant {
  id: number;
  email: string;
  event_id: number;
  slug: string;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface V2ParticipantAttribute {
  id: number;
  participant_id: number;
  attribute_id: number;
  value: string | null;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface V2ParticipantEmail {
  id: number;
  participant_id: number | null;
  email_id: number | null;
  send_at: Date | null;
  send_by: string | null;
  status: string;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface V2Data {
  admins: V2Admin[];
  permissions: V2Permission[];
  adminPermissions: V2AdminPermission[];
  events: V2Event[];
  attributes: V2Attribute[];
  blocks: V2Block[];
  forms: V2Form[];
  formDefinitions: V2FormDefinition[];
  emails: V2Email[];
  participants: V2Participant[];
  participantAttributes: V2ParticipantAttribute[];
  participantEmails: V2ParticipantEmail[];
}

export interface BlobRef {
  bucket: "events" | "forms";
  key: string;
}

export interface PlannedRow {
  sourceKey: string;
  targetId: string;
  payload: Record<string, unknown>;
  insertOnly?: Record<string, unknown>;
  refs: string[];
  archived?: Record<string, unknown>;
  blob?: BlobRef & { path: string };
}

export interface PlannedEntity {
  name: string;
  rows: PlannedRow[];
  seenKeys: Set<string>;
  prunable: boolean;
}

export interface Issue {
  entity: string;
  key: string;
  message: string;
}

export interface Plan {
  entities: PlannedEntity[];
  skippedTargets: Set<string>;
  referencedFiles: BlobRef[];
  exceptions: Issue[];
  warnings: Issue[];
  fatal: Issue[];
}

export interface LedgerEntry {
  entity: string;
  sourceKey: string;
  targetId: string;
  payloadHash: string;
}
