# Audit log

Every change that an admin or a participant makes to the state of an event is stored in the `AuditLog` table and exposed per event at `GET /api/v3/events/:eventId/audit-logs` (requires `MANAGE_ALL`).

Out of scope: auth and session actions, account level admin changes, automatic emails and event deletion (the log is deleted together with its event).

## Recording a change

Services record changes explicitly with `AuditLogService.record(tx, entry)` inside the same transaction as the write, so the log row commits or rolls back with the action. There is no Prisma extension or event emitter on purpose: the actor and the display snapshots are only known at the call site.

- Import `AuditLogModule` in the feature module and inject `AuditLogService`.
- Admin routes take the actor with `@CurrentAuditActor()` and pass it down to the service. Participant actions use `participantActor(...)` from `audit-actor.ts`. Background work uses `SYSTEM_ACTOR`.
- Action codes and entity types live in `audit-log.constants.ts`. Add new codes there.
- Every new mutation needs a test in its `*.int.spec.ts` that asserts the log row (action, actor, entity, changes).

## Shape of an entry

An entry stores snapshots, so it stays readable after the entity is renamed or deleted:

- `actorType`, `actorUuid`, `actorName`
- `entityType`, `entityUuid`, `entityLabel`
- `changes`: a list of typed changes the frontend can render without extra lookups
- `correlationId`: shared by all entries of one bulk operation (import, bulk update, reorder)

Change kinds:

| kind      | fields                   | used for                                         |
| --------- | ------------------------ | ------------------------------------------------ |
| `value`   | `from`, `to`             | scalar fields and scalar attribute values        |
| `list`    | `added`, `removed`       | multi value fields (multiSelect, permissions...) |
| `blocks`  | `added`, `removed`       | block attribute values, as `{uuid, name}`        |
| `file`    | `from`, `to` as `{name}` | file and drawing values, never the storage key   |
| `changed` | none                     | large fields whose value is not stored (content) |

Participant attribute changes also carry `attribute: {uuid, name, type}`.

## What gets logged

Build the `changes` list from an explicit allowlist of fields per entity (see `AUDITED_*_FIELDS` in the services). Never log passwords, tokens, IPs or storage keys. A new column is not logged until it is added to the allowlist.
