export function buildAttributeHeaders(
  attributes: { uuid: string; name: string }[],
): string[] {
  const counts = new Map<string, number>();

  return attributes.map((attribute) => {
    const base = attribute.name.trim().length > 0 ? attribute.name : "N/A";
    const count = (counts.get(base) ?? 0) + 1;
    counts.set(base, count);

    return count === 1 ? base : `${base} (${attribute.uuid})`;
  });
}
