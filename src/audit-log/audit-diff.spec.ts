import { AttributeType } from "src/generated/prisma/client";

import { buildAttributeChange, diffFields } from "./audit-diff";
import type { AuditAttributeRef } from "./audit-log.types";

const lookups = {
  blockNames: new Map([
    ["b1", "Workshop A"],
    ["b2", "Workshop B"],
  ]),
  fileNames: new Map([["key-1", "photo.png"]]),
};

function attribute(type: AttributeType): AuditAttributeRef {
  return { uuid: "attr-1", name: "Attr", type };
}

describe("diffFields", () => {
  it("returns only changed allowlisted fields", () => {
    const changes = diffFields(
      { name: "Old", location: "Wroclaw", secret: "a" },
      { name: "New", location: "Wroclaw", secret: "b" },
      ["name", "location"],
    );

    expect(changes).toEqual([
      { kind: "value", field: "name", from: "Old", to: "New" },
    ]);
  });

  it("treats a missing side as null for created and deleted entities", () => {
    expect(diffFields(null, { name: "New" }, ["name"])).toEqual([
      { kind: "value", field: "name", from: null, to: "New" },
    ]);
    expect(diffFields({ name: "Old" }, null, ["name"])).toEqual([
      { kind: "value", field: "name", from: "Old", to: null },
    ]);
  });

  it("serializes dates", () => {
    const date = new Date("2026-01-01T00:00:00.000Z");
    expect(diffFields({ d: null }, { d: date }, ["d"])).toEqual([
      { kind: "value", field: "d", from: null, to: date.toISOString() },
    ]);
  });
});

describe("buildAttributeChange", () => {
  it("returns null when value is unchanged", () => {
    expect(
      buildAttributeChange(attribute(AttributeType.text), "a", "a", lookups),
    ).toBeNull();
  });

  it("builds from/to for scalar types", () => {
    expect(
      buildAttributeChange(attribute(AttributeType.text), null, "a", lookups),
    ).toMatchObject({ kind: "value", from: null, to: "a" });
  });

  it("builds added/removed for multiSelect regardless of order", () => {
    const change = buildAttributeChange(
      attribute(AttributeType.multiSelect),
      ["a", "b"],
      ["c", "a"],
      lookups,
    );

    expect(change).toMatchObject({
      kind: "list",
      added: ["c"],
      removed: ["b"],
    });
    expect(
      buildAttributeChange(
        attribute(AttributeType.multiSelect),
        ["a", "b"],
        ["b", "a"],
        lookups,
      ),
    ).toBeNull();
  });

  it("resolves block names for added and removed blocks", () => {
    const change = buildAttributeChange(
      attribute(AttributeType.block),
      ["b1"],
      ["b2"],
      lookups,
    );

    expect(change).toMatchObject({
      kind: "blocks",
      added: [{ uuid: "b2", name: "Workshop B" }],
      removed: [{ uuid: "b1", name: "Workshop A" }],
    });
  });

  it("never exposes the storage key for files", () => {
    const change = buildAttributeChange(
      attribute(AttributeType.file),
      "key-1",
      null,
      lookups,
    );

    expect(change).toEqual({
      kind: "file",
      field: "Attr",
      attribute: attribute(AttributeType.file),
      from: { name: "photo.png" },
      to: null,
    });
  });
});
