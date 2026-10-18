# AGENTS.md

Backend for Eventownik v3: NestJS 11, Prisma 7 on PostgreSQL, BullMQ on Redis, S3 storage (MinIO locally), Swagger.

- Feature modules live in `src/<module>/` (controller, service, `dto/`, `entities/`, specs next to the code). Shared code is in `src/common/`.
- Global prefix `/api`, URI version `3`. Swagger UI at `/api/docs`.
- Local environment setup: [docs/local-setup.md](docs/local-setup.md).

## Before you call work done

```bash
npm run lint
npm run typecheck
npm run format:check
npm test
```

CI runs the same checks plus `build`.

## API docs (Swagger)

Full standard: [docs/api-docs.md](docs/api-docs.md).

- Every route needs `@ApiOperation` and a response decorator for each status it returns (success and expected errors).
- Document path and query params with `@ApiParam` / `@ApiQuery`.
- DTOs: follow the optional vs nullable rules in the doc. The swagger CLI plugin infers types, so do not add redundant `@ApiProperty`.

## Tests

Full guide: [docs/integration-tests.md](docs/integration-tests.md).

- Code that touches Prisma gets a `<module>.int.spec.ts` test against the real database. Never mock `PrismaService` there.
- Run `npm run migrate:test` after pulling or adding migrations, before `npm test`.
- Never run tests against the dev database. Use `.env.test`.
- Clean up only the rows your suite created (tracked UUIDs). Never a blanket `deleteMany()`, specs run in parallel.
- Mock only external things: mail, queues, HTTP calls, JWT.

## Other

- Commits follow commitlint (conventional commits). CI rejects the PR otherwise.
- Never edit an applied migration. Add a new one: `npx prisma migrate dev --name <name>`.
