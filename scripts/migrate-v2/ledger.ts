import type { Prisma } from "src/generated/prisma/client";

import type { LedgerEntry, PlannedRow } from "./types";

type SqlClient = Prisma.TransactionClient;

export async function ensureLedger(client: SqlClient) {
  await client.$executeRaw`CREATE SCHEMA IF NOT EXISTS v2_migration`;
  await client.$executeRaw`
    CREATE TABLE IF NOT EXISTS v2_migration.ledger (
      entity text NOT NULL,
      source_key text NOT NULL,
      target_id text NOT NULL,
      payload_hash text NOT NULL,
      archived jsonb,
      migrated_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (entity, source_key)
    )`;
}

export async function loadLedger(client: SqlClient): Promise<LedgerEntry[]> {
  const exists = await client.$queryRaw<{ present: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'v2_migration' AND table_name = 'ledger'
    ) AS present`;
  if (!exists[0]?.present) {
    return [];
  }

  const rows = await client.$queryRaw<
    {
      entity: string;
      source_key: string;
      target_id: string;
      payload_hash: string;
    }[]
  >`SELECT entity, source_key, target_id, payload_hash FROM v2_migration.ledger`;
  return rows.map((row) => ({
    entity: row.entity,
    sourceKey: row.source_key,
    targetId: row.target_id,
    payloadHash: row.payload_hash,
  }));
}

export async function writeLedger(
  client: SqlClient,
  entity: string,
  row: PlannedRow,
  payloadHash: string,
) {
  const archived =
    row.archived === undefined ? null : JSON.stringify(row.archived);
  await client.$executeRaw`
    INSERT INTO v2_migration.ledger
      (entity, source_key, target_id, payload_hash, archived)
    VALUES
      (${entity}, ${row.sourceKey}, ${row.targetId}, ${payloadHash}, ${archived}::jsonb)
    ON CONFLICT (entity, source_key) DO UPDATE SET
      payload_hash = EXCLUDED.payload_hash,
      archived = EXCLUDED.archived,
      updated_at = now()`;
}

export async function removeLedger(
  client: SqlClient,
  entity: string,
  sourceKey: string,
) {
  await client.$executeRaw`
    DELETE FROM v2_migration.ledger
    WHERE entity = ${entity} AND source_key = ${sourceKey}`;
}
