# Local Setup

How to run Eventownik v3 backend and its tests on your machine.

## Prerequisites

- Node.js 22
- Docker with Compose

## 1. Install dependencies

```bash
npm ci
```

## 2. Start services

```bash
docker compose up -d
```

| Service         | Port        | Purpose                                                          |
| --------------- | ----------- | ---------------------------------------------------------------- |
| `postgres`      | 5432        | Dev database                                                     |
| `postgres-test` | 5433        | Test database. Tests write real rows, keep it separate from dev. |
| `redis`         | 6379        | BullMQ queues                                                    |
| `minio`         | 9000 / 9001 | S3 storage (API / console). Creates `events` and `forms` buckets |

You can start only what you need, e.g. `docker compose up -d postgres-test` if you only run tests.

## 3. Configure environment

```bash
cp .env.example .env
cp .env.test.example .env.test
```

The defaults match the compose services. `.env.test` must point at `postgres-test` (port 5433).

## 4. Prisma

```bash
npx prisma generate
```

### Dev database

```bash
npx prisma migrate dev --name <migration_name>   # create and apply a new migration
npx prisma migrate deploy                        # only apply existing migrations
npm run seed:dev                                 # seed sample data
```

Never edit a migration that was already applied. Add a new one.

### Test database

```bash
npm run migrate:test
```

Run it once on first setup, and again **whenever new migrations are added** (after pulling, or after creating one). A stale test schema causes confusing failures.

## 5. Run

```bash
npm run start:dev
```

- API: `http://localhost:3000/api` (URI version `3`)
- Swagger UI: `http://localhost:3000/api/docs`

## 6. Test and check

```bash
npm test               # unit and integration tests (needs the test DB)
npm run lint
npm run typecheck
npm run format:check
```

See [integration-tests.md](integration-tests.md) for how to write integration tests.
