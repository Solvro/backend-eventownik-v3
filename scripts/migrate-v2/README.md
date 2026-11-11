# v2 to v3 data migration

One-way, re-runnable copy of the Adonis v2 database (and its uploaded files) into v3.

A run is a **dry run** unless `--apply` is passed. Dry run reads both databases, maps everything and prints a report, but writes nothing.

## Run

```bash
V2_DATABASE_URL=postgresql://... DATABASE_URL=postgresql://... \
  npm run migrate:v2 -- [--apply] [--prune] [--v2-storage-dir <dir>]
```

| Flag                     | Meaning                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| `--apply`                | Write to v3. Without it nothing is changed.                                                               |
| `--prune`                | With `--apply`: delete v3 rows whose v2 source was deleted. Without it they are only reported.            |
| `--v2-storage-dir <dir>` | v2 storage root holding `public/` (event photos) and `uploads/` (form files). Needs the `S3_*` variables. |

Exit code is non-zero when rows were skipped, failed or conflicted, or when v2 holds data the mapping does not know.

## As a container

Build from the repository root, then start it with the v2 volume mounted read-only:

```bash
docker build -f scripts/migrate-v2/Dockerfile -t eventownik-migrate-v2 .
docker run --rm --env-file migrate.env \
  -v <v2_storage_volume>:/v2-storage:ro \
  eventownik-migrate-v2 --v2-storage-dir /v2-storage
```

Add `--apply` once the dry run report looks right. The container only needs network access to both databases and S3.

### As a Coolify app

Deploy the main `Dockerfile` with build target `migrate`. The container idles, so open its terminal and run `npm run migrate:v2 -- --v2-storage-dir /v2-storage [--apply]`. Set `V2_DATABASE_URL` and bind mount the v2 `public/` and `uploads/` host directories under `/v2-storage`.

## How reruns work

Progress is kept in the `v2_migration.ledger` table inside the v3 database. The script creates it on the first `--apply`. It is not part of the Prisma schema, so removing it after cutover is `DROP SCHEMA v2_migration CASCADE`.

For each row the ledger stores the v2 id, the v3 id and a hash of what was written.

- Not in the ledger: inserted.
- v2 data changed: updated.
- v2 data unchanged: left alone.
- v3 row differs from what the script wrote (edited in v3, or deleted): reported as a **conflict** and left alone.
- Gone from v2: reported, deleted only with `--prune`.

Rows with data problems are skipped and listed with a reason, together with everything that depends on them. Fix them in v2 and run again. Unknown enum values (attribute type, email trigger, permission, admin type, email status) abort the run before anything is written.

## Mapping notes

- Participant and form v2 `slug` is reused as the v3 `uuid` when it is a valid unused uuid, otherwise a new uuid is generated (listed in the warnings).
- `is_active` becomes `isPublic`, and active events are marked verified on first insert only.
- Forms are all `MANUAL` with `isOpen` copied. `isEditable` is true only when every form definition is editable.
- Admin passwords keep the v2 scrypt hash. Login rehashes them to bcrypt (`src/auth/legacy-scrypt.ts`, remove once no `$scrypt$` hashes remain).
- Fields without a v3 home (`lat`/`long`, attribute `slug`, `is_sensitive_data`, `reason`, form `slug`, `submissions_left`, email `form_id`, participant `slug`) are archived as JSON in the ledger.
- Tickets, check-ins, logs, tokens and uploaded-file rows have no v2 source and stay empty. Admins log in again after cutover.
