# Integration Testing Guide

This document explains how to write database integration tests in this project.
The reference implementation is [`src/organizers/organizers.int.spec.ts`](../src/organizers/organizers.int.spec.ts) — read it alongside this guide.

---

## Why real-database tests?

The existing `*.service.spec.ts` files are **unit tests**: they mock `PrismaService` entirely and test that the service calls Prisma with certain arguments. They are useful for pure logic (pagination math, exception mapping, DTO transformation) but they do **not** catch:

- A typo in a Prisma `where` clause
- A wrong relation name (e.g. `events` vs `event`)
- A unique constraint violation that should become a `BadRequestException`
- A `$transaction` that silently does nothing because a `findFirst` returned `null`

Integration tests fix this by running every Prisma call against a real PostgreSQL database. The trade-off is that they are slower (~20–200 ms per test) and require a database to be available.

---

## Local setup (one-time)

1. **Create `.env.test`** — copy the example file:

   ```bash
   cp .env.test.example .env.test
   ```

   Edit it to point at a local PostgreSQL database **that is separate from your dev database**. The test suite writes real rows to it.

2. **Apply migrations to the test database:**

   ```bash
   npm run migrate:test
   ```

   Run this again whenever new migrations are added.

3. **Run the tests:**

   ```bash
   npm test
   ```

   `DATABASE_URL` from `.env.test` is automatically picked up by the test runner (configured in `jest.setup.ts`). CI already injects `DATABASE_URL` as an environment variable, so no changes are needed there.

---

## File naming

| File                   | Purpose                                                 |
| ---------------------- | ------------------------------------------------------- |
| `*.service.spec.ts`    | Unit tests — mock Prisma, test pure logic               |
| `*.int.spec.ts`        | Integration tests — real database, test actual behavior |
| `*.controller.spec.ts` | Unit tests for controller routing / guard logic         |

When you are writing a new integration test file, name it `<module>.int.spec.ts` and place it next to the service file.

---

## Anatomy of an integration test file

Every `*.int.spec.ts` follows the same four-part structure.

### 1. Module setup — `beforeAll`

Compile a real NestJS testing module **once** for the entire suite. Provide the real `PrismaService` — no mocks.

```typescript
let service: MyService;
let prisma: PrismaService;

beforeAll(async () => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [MyService, PrismaService],
  }).compile();

  service = module.get<MyService>(MyService);
  prisma = module.get<PrismaService>(PrismaService);
});
```

Use `beforeAll` (not `beforeEach`) so the module is compiled only once. Compiling per test adds several seconds to the suite.

### 2. Cleanup — `afterAll`

Delete exactly the rows this suite created, then disconnect.

```typescript
const createdAdminUuids: string[] = [];
const createdEventUuids: string[] = [];

afterAll(async () => {
  // Delete in FK-safe order — child tables before parent tables.
  // EventPermission has no cascade, so it must go first.
  await prisma.eventPermission.deleteMany({
    where: {
      OR: [
        { eventUuid: { in: createdEventUuids } },
        { adminUuid: { in: createdAdminUuids } },
      ],
    },
  });
  await prisma.event.deleteMany({ where: { uuid: { in: createdEventUuids } } });
  await prisma.admin.deleteMany({ where: { uuid: { in: createdAdminUuids } } });

  await prisma.$disconnect();
});
```

**Why track UUIDs instead of `deleteMany()` with no `where`?**
Jest runs test files in parallel across workers. A blanket `deleteMany()` on `Admins` would delete rows that another spec file is currently using. Scoped cleanup is parallel-safe.

**Why `afterAll` instead of `afterEach`?**
Each test creates data with unique identifiers (see factories below), so tests never share rows and there is nothing to reset between them. `afterAll` means one cleanup pass instead of one per test.

If your test calls a service method that creates a brand new top-level record (like creating a new Admin), you must manually push that resulting UUID into the tracking array at the end of the test, or it will leak.

### 3. Factories

Factory functions create the precondition data each test needs. They:

- Insert directly via `prisma` (not via the service under test)
- Generate unique identifiers so tests never collide
- Push every created UUID into the tracking arrays

```typescript
async function createAdmin(
  overrides: Partial<{ email: string; active: boolean }> = {},
): Promise<Admin> {
  const admin = await prisma.admin.create({
    data: {
      firstName: "Test",
      lastName: "User",
      email: `${String(Date.now())}-${Math.random().toString(36).slice(2)}@test.local`,
      password: "$2b$10$placeholder.not.a.real.hash",
      active: true,
      ...overrides,
    },
  });
  createdAdminUuids.push(admin.uuid);
  return admin;
}
```

A few rules for factories:

- **Always push the UUID** into the tracking array before returning.
- **Accept `overrides`** so individual tests can set specific fields (e.g. `active: false`).
- **Keep them minimal** — only the fields required by the DB, plus whatever is relevant for the tests in this file.
- **Never go through the service** to set up preconditions. Use Prisma directly. This keeps setup fast and independent of the thing you are testing.

### 4. Tests

With the setup above, each test becomes short and readable:

```typescript
it("filters organizers by active status", async () => {
  const active = await createAdmin({ active: true });
  const inactive = await createAdmin({ active: false });
  const event = await createEvent(active.uuid);
  await assignPermissions(inactive.uuid, event.uuid);

  const query = Object.assign(new OrganizerListingDto(), { isActive: true });
  const result = await service.findAll(event.uuid, query);

  const emails = result.data.map((o) => o.email);
  expect(emails).toContain(active.email);
  expect(emails).not.toContain(inactive.email);
});
```

Notice:

- **Arrange** — factories build the exact state this test needs.
- **Act** — call the service method under test.
- **Assert** — check the result, not how Prisma was called.

---

## What to mock, what not to mock

| Always mock                                                  | Never mock                           |
| ------------------------------------------------------------ | ------------------------------------ |
| Email sending (`MailerService`)                              | `PrismaService`                      |
| BullMQ queues (assert jobs were enqueued, not that they ran) | Any service you are directly testing |
| External HTTP calls (hCaptcha, etc.)                         | Database transactions                |
| JWT generation / validation                                  | Cascade / constraint behavior        |

If you find yourself mocking `PrismaService` in a `*.int.spec.ts`, stop — that belongs in `*.service.spec.ts` instead.

---

## Null-safety in assertions

When you use `.find()` on a result array, TypeScript types the result as `T | undefined`. Do not use the `!` non-null assertion operator — the linter forbids it. Use `expect` followed by an `if` type-guard:

```typescript
const organizer = result.data.find((o) => o.email === admin.email);
expect(organizer).toBeDefined(); // fails the test if not found
if (organizer == null) {
  return;
} // narrows the type for TypeScript
expect(organizer.permissions).toHaveLength(2);
```

The `expect` on the line above ensures the test fails with a clear message if `organizer` is `null`. The `if` guard is only for the type checker — it is never reached at runtime.

---

## Template literals with numbers

The linter (`@typescript-eslint/restrict-template-expressions`) does not allow non-string types in template literals. `Date.now()` returns a `number`. Always wrap it:

```typescript
// ❌ lint error
`event-${Date.now()}-suffix`
// ✅ correct
`event-${String(Date.now())}-suffix`;
```

---

## Quick-start template

Copy this skeleton when starting a new `*.int.spec.ts`:

```typescript
import { PrismaService } from "src/prisma/prisma.service";

import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";

import { MyService } from "./my.service";

describe("MyService (integration)", () => {
  let service: MyService;
  let prisma: PrismaService;

  // Add one array per entity type your tests create.
  const createdFooUuids: string[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MyService, PrismaService],
    }).compile();

    service = module.get<MyService>(MyService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // Delete child rows before parent rows to respect FK constraints.
    await prisma.foo.deleteMany({ where: { uuid: { in: createdFooUuids } } });
    await prisma.$disconnect();
  });

  // --- Factories ---

  async function createFoo(): Promise<{ uuid: string }> {
    const foo = await prisma.foo.create({
      data: {
        /* ... */
      },
    });
    createdFooUuids.push(foo.uuid);
    return foo;
  }

  // --- Tests ---

  describe("findOne", () => {
    it("returns the record when it exists", async () => {
      const foo = await createFoo();

      const result = await service.findOne(foo.uuid);

      expect(result.uuid).toBe(foo.uuid);
    });

    it("throws NotFoundException when the record does not exist", async () => {
      await expect(
        service.findOne("00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
```
