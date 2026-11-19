import { IdRegistry } from "./id-registry";

const SLUG = "11111111-1111-4111-8111-111111111111";

describe("IdRegistry", () => {
  it("uses a valid unused slug as the id", () => {
    const registry = new IdRegistry();
    expect(registry.assign("Participant", "1", SLUG.toUpperCase())).toBe(SLUG);
  });

  it("generates an id for invalid slugs", () => {
    const registry = new IdRegistry();
    expect(registry.assign("Participant", "1", "legacy")).not.toBe("legacy");
  });

  it("gives a duplicate slug to the first row only", () => {
    const registry = new IdRegistry();
    registry.assign("Participant", "1", SLUG);
    expect(registry.assign("Participant", "2", SLUG)).not.toBe(SLUG);
  });

  it("allows the same slug in different entities", () => {
    const registry = new IdRegistry();
    registry.assign("Participant", "1", SLUG);
    expect(registry.assign("Form", "1", SLUG)).toBe(SLUG);
  });

  it("is stable for an already assigned key", () => {
    const registry = new IdRegistry();
    const first = registry.assign("Form", "1");
    expect(registry.assign("Form", "1")).toBe(first);
  });

  it("keeps ledger ids and does not reuse them", () => {
    const registry = new IdRegistry();
    registry.preload("Participant", "1", "legacy-id");
    expect(registry.assign("Participant", "1", SLUG)).toBe("legacy-id");
    registry.preload("Participant", "9", SLUG);
    expect(registry.assign("Participant", "2", SLUG)).not.toBe(SLUG);
  });

  it("throws when requiring an unknown row", () => {
    expect(() => new IdRegistry().require("Event", "5")).toThrow(
      "Event 5 does not exist in v2",
    );
  });
});
