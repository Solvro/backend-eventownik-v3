import { scrypt, timingSafeEqual } from "node:crypto";

const LEGACY_SCRYPT_PATTERN =
  /^\$scrypt\$n=(\d+),r=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/;

export function isLegacyScryptHash(hash: string): boolean {
  return hash.startsWith("$scrypt$");
}

export async function verifyLegacyScrypt(
  hash: string,
  password: string,
): Promise<boolean> {
  const match = LEGACY_SCRYPT_PATTERN.exec(hash);
  if (match === null) {
    return false;
  }

  const [, cost, blockSize, parallelization, salt, expected] = match;
  const expectedHash = Buffer.from(expected, "base64");

  const derived = await new Promise<Buffer | null>((resolve) => {
    scrypt(
      password,
      Buffer.from(salt, "base64"),
      expectedHash.length,
      {
        N: Number(cost),
        r: Number(blockSize),
        p: Number(parallelization),
        maxmem: 256 * Number(cost) * Number(blockSize),
      },
      (error, key) => {
        resolve(error === null ? key : null);
      },
    );
  });

  return derived !== null && timingSafeEqual(derived, expectedHash);
}
