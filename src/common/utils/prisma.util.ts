type SortOrder = "asc" | "desc";

export function parseSortInput(
  sort: string | undefined,
  allowedFields: string[],
) {
  if (!sort) return [];

  const results: Record<string, SortOrder>[] = [];

  sort.split(",").forEach((pair) => {
    const [field, direction] = pair.split(":");

    if (allowedFields.includes(field)) {
      const validDir: SortOrder = direction === "desc" ? "desc" : "asc";
      results.push({ [field]: validDir });
    }
  });

  return results;
}
