/**
 * Parses the `TRUST_PROXY` env value into a value accepted by Express' `trust proxy` setting.
 * - unset or empty: `false` (use the socket address, ignore forwarding headers)
 * - `true` / `false`: boolean
 * - integer: number of trusted hops in front of the app
 * - anything else: comma-separated list of trusted addresses or CIDR ranges
 * @see https://expressjs.com/en/guide/behind-proxies.html
 */
export function parseTrustProxy(
  value: string | undefined,
): boolean | number | string {
  const trimmed = value?.trim();
  if (trimmed === undefined || trimmed === "" || trimmed === "false") {
    return false;
  }
  if (trimmed === "true") {
    return true;
  }
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  return trimmed;
}
