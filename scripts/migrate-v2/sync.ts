import type { PrismaClient } from "src/generated/prisma/client";

import type { EntityAdapter } from "./adapters";
import { hashPayload } from "./canonical";
import { removeLedger, writeLedger } from "./ledger";
import type { Issue, LedgerEntry, Plan, PlannedRow } from "./types";

export interface EntityStats {
  insert: number;
  update: number;
  unchanged: number;
  conflicts: number;
  skippedByDependency: number;
  failed: number;
  deletedInV2: number;
}

export interface SyncResult {
  stats: Map<string, EntityStats>;
  conflicts: Issue[];
  failures: Issue[];
}

export interface SyncOptions {
  apply: boolean;
  prune: boolean;
}

const emptyStats = (): EntityStats => ({
  insert: 0,
  update: 0,
  unchanged: 0,
  conflicts: 0,
  skippedByDependency: 0,
  failed: 0,
  deletedInV2: 0,
});

export async function syncPlan(
  prisma: PrismaClient,
  plan: Plan,
  ledger: LedgerEntry[],
  adapterFor: (entity: string) => EntityAdapter,
  options: SyncOptions,
): Promise<SyncResult> {
  const result: SyncResult = {
    stats: new Map(),
    conflicts: [],
    failures: [],
  };
  const entriesByEntity = new Map<string, Map<string, LedgerEntry>>();
  for (const entry of ledger) {
    const entries =
      entriesByEntity.get(entry.entity) ?? new Map<string, LedgerEntry>();
    entries.set(entry.sourceKey, entry);
    entriesByEntity.set(entry.entity, entries);
  }

  const write = async (
    entity: string,
    adapter: EntityAdapter,
    row: PlannedRow,
    mode: "insert" | "update",
    hash: string,
  ) => {
    await prisma.$transaction(async (tx) => {
      await adapter.write(tx, row, mode);
      await writeLedger(tx, entity, row, hash);
    });
  };

  for (const entity of plan.entities) {
    const stats = emptyStats();
    result.stats.set(entity.name, stats);
    const adapter = adapterFor(entity.name);
    const entries =
      entriesByEntity.get(entity.name) ?? new Map<string, LedgerEntry>();

    for (const row of entity.rows) {
      if (row.refs.some((ref) => plan.skippedTargets.has(ref))) {
        stats.skippedByDependency += 1;
        plan.skippedTargets.add(row.targetId);
        continue;
      }

      const hash = hashPayload(row.payload);
      const entry = entries.get(row.sourceKey);
      const issue = (message: string): Issue => ({
        entity: entity.name,
        key: row.sourceKey,
        message,
      });

      try {
        if (entry === undefined) {
          stats.insert += 1;
          if (options.apply) {
            await write(entity.name, adapter, row, "insert", hash);
          }
        } else if (entry.payloadHash === hash) {
          stats.unchanged += 1;
        } else {
          const current = await adapter.read(
            entry.targetId,
            Object.keys(row.payload),
          );
          if (current === null) {
            stats.conflicts += 1;
            result.conflicts.push(issue("deleted in v3 after migration"));
            plan.skippedTargets.add(row.targetId);
          } else if (hashPayload(current) === entry.payloadHash) {
            stats.update += 1;
            if (options.apply) {
              await write(entity.name, adapter, row, "update", hash);
            }
          } else {
            stats.conflicts += 1;
            result.conflicts.push(issue("edited in v3 after migration"));
          }
        }
      } catch (error) {
        stats.failed += 1;
        stats.insert -= entry === undefined ? 1 : 0;
        plan.skippedTargets.add(row.targetId);
        result.failures.push(
          issue(
            error instanceof Error
              ? error.message || error.name
              : String(error),
          ),
        );
      }
    }
  }

  for (const entity of plan.entities.toReversed()) {
    if (!entity.prunable) {
      continue;
    }
    const stats = result.stats.get(entity.name) ?? emptyStats();
    const adapter = adapterFor(entity.name);
    for (const entry of entriesByEntity.get(entity.name)?.values() ?? []) {
      if (entity.seenKeys.has(entry.sourceKey)) {
        continue;
      }
      stats.deletedInV2 += 1;
      if (options.apply && options.prune) {
        await prisma.$transaction(async (tx) => {
          await adapter.remove(tx, entry.targetId);
          await removeLedger(tx, entity.name, entry.sourceKey);
        });
      }
    }
  }

  return result;
}
