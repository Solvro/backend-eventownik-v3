import type { SyncResult } from "./sync";
import type { Issue, Plan } from "./types";

function printIssues(title: string, issues: Issue[]) {
  if (issues.length === 0) {
    return;
  }
  console.log(`\n${title} (${String(issues.length)})`);
  for (const issue of issues) {
    console.log(`  ${issue.entity} ${issue.key}: ${issue.message}`);
  }
}

export function printReport(
  plan: Plan,
  result: SyncResult | null,
  mode: { apply: boolean; prune: boolean },
) {
  console.log(
    mode.apply
      ? `\nAPPLIED${mode.prune ? " (with prune)" : ""}`
      : "\nDRY RUN - nothing was written",
  );

  if (result !== null) {
    console.log(
      "\nentity                  insert update same conflict dep-skip failed deleted-in-v2",
    );
    for (const [name, stats] of result.stats) {
      console.log(
        [
          name.padEnd(23),
          String(stats.insert).padStart(6),
          String(stats.update).padStart(6),
          String(stats.unchanged).padStart(4),
          String(stats.conflicts).padStart(8),
          String(stats.skippedByDependency).padStart(8),
          String(stats.failed).padStart(6),
          String(stats.deletedInV2).padStart(14),
        ].join(" "),
      );
    }
  }

  printIssues("Fatal structural problems", plan.fatal);
  printIssues("Skipped rows", plan.exceptions);
  printIssues("Failed writes", result?.failures ?? []);
  printIssues("Conflicts", result?.conflicts ?? []);
  printIssues("Warnings", plan.warnings);
}
