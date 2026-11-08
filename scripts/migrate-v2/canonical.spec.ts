import { hashPayload } from "./canonical";

describe("hashPayload", () => {
  it("ignores key order", () => {
    expect(hashPayload({ a: 1, b: { c: 2, d: 3 } })).toBe(
      hashPayload({ b: { d: 3, c: 2 }, a: 1 }),
    );
  });

  it("ignores createdAt and updatedAt", () => {
    expect(hashPayload({ a: 1, updatedAt: new Date(1) })).toBe(
      hashPayload({ a: 1, updatedAt: new Date(2), createdAt: new Date(3) }),
    );
  });

  it("hashes dates by instant", () => {
    expect(hashPayload({ d: new Date("2026-01-01T00:00:00Z") })).toBe(
      hashPayload({ d: new Date("2026-01-01T01:00:00+01:00") }),
    );
  });

  it("detects value changes", () => {
    expect(hashPayload({ a: 1 })).not.toBe(hashPayload({ a: 2 }));
    expect(hashPayload({ a: null })).not.toBe(hashPayload({ a: "" }));
  });
});
