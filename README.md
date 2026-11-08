# backend-eventownik

![Solvro banner](https://github.com/Solvro/backend-topwr-sks/blob/main/assets/solvro_dark.png#gh-dark-mode-only)
![Solvro banner](https://github.com/Solvro/backend-topwr-sks/blob/main/assets/solvro_light.png#gh-light-mode-only)

Backend for Eventownik v3. NestJS 11, Prisma 7 on PostgreSQL, BullMQ on Redis, S3 storage, Swagger.

## Getting started

```bash
npm ci
docker compose up -d
cp .env.example .env
cp .env.test.example .env.test
npx prisma migrate deploy
npm run migrate:test
npm run start:dev
```

The API runs at `http://localhost:3000/api`, Swagger UI at `http://localhost:3000/api/docs`.
Details (services, env files, migrations, seeding): [docs/local-setup.md](docs/local-setup.md).

## Scripts

| Script                 | What it does                          |
| ---------------------- | ------------------------------------- |
| `npm run start:dev`    | Start with watch mode                 |
| `npm run start:debug`  | Start with debugger and watch mode    |
| `npm run build`        | Generate Prisma client and build      |
| `npm run start:prod`   | Run the built app                     |
| `npm test`             | Unit and integration tests            |
| `npm run test:cov`     | Tests with coverage                   |
| `npm run migrate:test` | Apply migrations to the test database |
| `npm run seed:dev`     | Seed the dev database                 |
| `npm run lint`         | ESLint (with autofix)                 |
| `npm run format`       | Prettier (write)                      |
| `npm run format:check` | Prettier (check only)                 |
| `npm run typecheck`    | TypeScript check                      |

## Docs

- [Local setup](docs/local-setup.md)
- [API documentation standard (Swagger)](docs/api-docs.md)
- [Integration testing guide](docs/integration-tests.md)
- [AGENTS.md](AGENTS.md) - instructions for AI coding agents

## Links

[![docs.solvro.pl](https://i.imgur.com/fuV0gra.png)](https://docs.solvro.pl)
