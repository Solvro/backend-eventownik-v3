import { stat } from "node:fs/promises";
import path from "node:path";

import type { Plan, PlannedEntity } from "./types";

const SUBFOLDERS = { events: "public", forms: "uploads" } as const;

export async function addBlobEntity(
  plan: Plan,
  storageDirectory: string | undefined,
) {
  const unique = new Map(
    plan.referencedFiles.map((file) => [`${file.bucket}/${file.key}`, file]),
  );

  if (storageDirectory === undefined) {
    if (unique.size > 0) {
      plan.warnings.push({
        entity: "Blob",
        key: "-",
        message: `${String(unique.size)} referenced files not migrated, pass --v2-storage-dir`,
      });
    }
    return;
  }

  const entity: PlannedEntity = {
    name: "Blob",
    rows: [],
    seenKeys: new Set(),
    prunable: false,
  };

  for (const [id, file] of unique) {
    entity.seenKeys.add(id);
    const localPath = path.join(
      storageDirectory,
      SUBFOLDERS[file.bucket],
      file.key,
    );
    if (path.basename(file.key) !== file.key) {
      plan.warnings.push({
        entity: "Blob",
        key: id,
        message: "unsafe file name, skipped",
      });
      continue;
    }
    try {
      const { size } = await stat(localPath);
      entity.rows.push({
        sourceKey: id,
        targetId: id,
        payload: { size },
        refs: [],
        blob: { ...file, path: localPath },
      });
    } catch {
      plan.warnings.push({
        entity: "Blob",
        key: id,
        message: `file not found at ${localPath}`,
      });
    }
  }

  plan.entities.unshift(entity);
}
