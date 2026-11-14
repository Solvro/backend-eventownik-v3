export function normalizeEmail(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}
