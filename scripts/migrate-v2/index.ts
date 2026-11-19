import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "src/generated/prisma/client";

import { createBlobAdapter, createModelAdapter } from "./adapters";
import { addBlobEntity } from "./blobs";
import { loadConfig } from "./config";
import { ensureLedger, loadLedger } from "./ledger";
import { buildPlan } from "./plan";
import { printReport } from "./report";
import { readV2 } from "./source";
import { syncPlan } from "./sync";

async function main() {
  const config = loadConfig(process.argv.slice(2));
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: config.v3DatabaseUrl }),
  });

  try {
    if (config.apply) {
      await ensureLedger(prisma);
    }
    const ledger = await loadLedger(prisma);
    const v2 = await readV2(config.v2DatabaseUrl);

    const plan = await buildPlan(v2, ledger, new Date());
    await addBlobEntity(plan, config.storageDirectory);

    if (plan.fatal.length > 0) {
      printReport(plan, null, config);
      process.exitCode = 1;
      return;
    }

    const blobAdapter =
      config.s3 === undefined ? undefined : createBlobAdapter(config.s3);
    const result = await syncPlan(
      prisma,
      plan,
      ledger,
      (entity) => {
        if (entity === "Blob") {
          if (blobAdapter === undefined) {
            throw new Error("Blob rows planned without S3 configuration");
          }
          return blobAdapter;
        }
        return createModelAdapter(
          prisma,
          entity === "EventRegisterForm" ? "Event" : entity,
          entity === "EventRegisterForm",
        );
      },
      config,
    );

    printReport(plan, result, config);
    const problems =
      plan.exceptions.length + result.conflicts.length + result.failures.length;
    process.exitCode = problems > 0 ? 1 : 0;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
