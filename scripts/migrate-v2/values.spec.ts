import { AttributeType } from "src/generated/prisma/client";

import { collectV2Values } from "./values";

describe("collectV2Values", () => {
  it("returns null for empty and null markers", () => {
    expect(collectV2Values(AttributeType.text, [null, "", "null"])).toBeNull();
    expect(collectV2Values(AttributeType.multiSelect, ["  "])).toBeNull();
  });

  it("returns the single value untouched for plain types", () => {
    expect(collectV2Values(AttributeType.text, ["a, b"])).toBe("a, b");
  });

  it("rejects several different values for a single-valued type", () => {
    expect(() => collectV2Values(AttributeType.select, ["a", "b"])).toThrow(
      "multiple values",
    );
  });

  it("accepts the same value repeated", () => {
    expect(collectV2Values(AttributeType.select, ["a", "a"])).toBe("a");
  });

  it("splits comma separated multiSelect values", () => {
    expect(collectV2Values(AttributeType.multiSelect, ["pl, en"])).toEqual([
      "pl",
      "en",
    ]);
  });

  it("reads JSON array multiSelect values", () => {
    expect(collectV2Values(AttributeType.multiSelect, ['["pl","en"]'])).toEqual(
      ["pl", "en"],
    );
  });

  it("merges multi-row block values without duplicates", () => {
    expect(
      collectV2Values(AttributeType.block, ["2", "3", "2,4", null]),
    ).toEqual(["2", "3", "4"]);
  });
});

describe("collectV2Values legacy formats", () => {
  it("parses brace-delimited multiselect values", () => {
    expect(
      collectV2Values(AttributeType.multiSelect, [
        '{"15:00","Później niż 15:00"}',
      ]),
    ).toEqual(["15:00", "Później niż 15:00"]);
  });

  it("maps affirmative checkbox labels to true", () => {
    expect(collectV2Values(AttributeType.checkbox, ["Tak/Yes"])).toBe("true");
    expect(collectV2Values(AttributeType.checkbox, ["Tak"])).toBe("true");
  });
});
