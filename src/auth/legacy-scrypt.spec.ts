import { randomBytes, scryptSync } from "node:crypto";

import { isLegacyScryptHash, verifyLegacyScrypt } from "./legacy-scrypt";

function hashLikeV2(password: string) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64, {
    N: 16_384,
    r: 8,
    p: 1,
    maxmem: 33_554_432,
  });
  return `$scrypt$n=16384,r=8,p=1$${salt.toString("base64").replace(/=+$/, "")}$${key.toString("base64").replace(/=+$/, "")}`;
}

describe("legacy scrypt", () => {
  const hash = hashLikeV2("correct horse");

  it("recognises v2 hashes", () => {
    expect(isLegacyScryptHash(hash)).toBe(true);
    expect(isLegacyScryptHash("$2b$12$abcdefghijklmnopqrstuv")).toBe(false);
  });

  it("verifies the right password", async () => {
    await expect(verifyLegacyScrypt(hash, "correct horse")).resolves.toBe(true);
  });

  it("rejects the wrong password", async () => {
    await expect(verifyLegacyScrypt(hash, "wrong")).resolves.toBe(false);
  });

  it("rejects malformed hashes", async () => {
    await expect(verifyLegacyScrypt("$scrypt$garbage", "x")).resolves.toBe(
      false,
    );
  });
});
