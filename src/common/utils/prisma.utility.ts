type SortOrder = "asc" | "desc";

export function parseSortInput(
  sort: string | undefined,
  allowedFields: string[],
) {
  if (sort === undefined || sort === "") {
    return [];
  }

  const results: Record<string, SortOrder>[] = [];

  for (const pair of sort.split(",")) {
    const [field, direction] = pair.split(":");

    if (allowedFields.includes(field)) {
      const validDirection: SortOrder = direction === "desc" ? "desc" : "asc";
      results.push({ [field]: validDirection });
    }
  }

  return results;
}
