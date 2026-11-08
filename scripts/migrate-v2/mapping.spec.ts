import {
  AttributeType,
  EmailTrigger,
  PermissionType,
} from "src/generated/prisma/client";

import {
  StructuralError,
  buildAttributeConfig,
  mapAttributeType,
  mapEmailTrigger,
  mapPermission,
  parseOptions,
} from "./mapping";
import type { V2Attribute } from "./types";

const attribute = (overrides: Partial<V2Attribute>): V2Attribute => ({
  id: 1,
  name: "attr",
  slug: null,
  event_id: 1,
  show_in_list: true,
  options: null,
  type: "text",
  order: 0,
  is_sensitive_data: false,
  reason: null,
  allow_other: false,
  is_multiple: false,
  max_selections: null,
  created_at: null,
  updated_at: null,
  ...overrides,
});

const multiSelectConfig = (maxSelections: number | null) =>
  buildAttributeConfig(
    attribute({ options: ["a"], max_selections: maxSelections }),
    AttributeType.multiSelect,
    0,
  );

describe("mapping", () => {
  it("maps casing differences between attribute types", () => {
    expect(mapAttributeType("textarea")).toBe(AttributeType.textArea);
    expect(mapAttributeType("multiselect")).toBe(AttributeType.multiSelect);
    expect(mapAttributeType("drawing")).toBe(AttributeType.drawing);
  });

  it("treats unknown enum values as structural errors", () => {
    expect(() => mapAttributeType("hologram")).toThrow(StructuralError);
    expect(() => mapEmailTrigger("on_full_moon")).toThrow(StructuralError);
    expect(() => mapPermission("manage", "billing")).toThrow(StructuralError);
  });

  it("maps triggers and permissions", () => {
    expect(mapEmailTrigger("form_filled")).toBe(EmailTrigger.FORM_FILLED);
    expect(mapPermission("manage", "setting")).toBe(
      PermissionType.MANAGE_SETTINGS,
    );
    expect(mapPermission("manage", "all")).toBe(PermissionType.MANAGE_ALL);
  });

  it("parses options stored as JSON text or arrays", () => {
    expect(parseOptions('["a","b"]')).toEqual(["a", "b"]);
    expect(parseOptions(["a", 2])).toEqual(["a", "2"]);
    expect(parseOptions("not json")).toEqual([]);
    expect(parseOptions(null)).toEqual([]);
  });

  describe("buildAttributeConfig", () => {
    it("builds select config", () => {
      expect(
        buildAttributeConfig(
          attribute({ options: ["a"], allow_other: true }),
          AttributeType.select,
          0,
        ),
      ).toEqual({ options: ["a"], allowOther: true });
    });

    it("includes maxSelections for multiSelect only when set", () => {
      expect(multiSelectConfig(2)).toEqual({
        options: ["a"],
        allowOther: false,
        maxSelections: 2,
      });
      expect(multiSelectConfig(null)).toEqual({
        options: ["a"],
        allowOther: false,
      });
    });

    it("limits single block attributes to one selection", () => {
      expect(
        buildAttributeConfig(attribute({}), AttributeType.block, 5),
      ).toEqual({ maxSelections: 1 });
    });

    it("uses the block count for unlimited multi block attributes", () => {
      expect(
        buildAttributeConfig(
          attribute({ is_multiple: true }),
          AttributeType.block,
          4,
        ),
      ).toEqual({ maxSelections: 4 });
    });

    it("returns an empty config for plain types", () => {
      expect(
        buildAttributeConfig(attribute({}), AttributeType.text, 0),
      ).toEqual({});
    });
  });
});
