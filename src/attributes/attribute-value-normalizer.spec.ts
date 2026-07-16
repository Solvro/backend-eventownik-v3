import { AttributeType, Prisma } from "src/generated/prisma/client";
import type { PrismaService } from "src/prisma/prisma.service";

import { BadRequestException } from "@nestjs/common";

import { normalizeParticipantAttributeValue } from "./attribute-value-normalizer";

function attribute(
  type: AttributeType,
  config: Prisma.JsonValue | null = null,
) {
  return { attributeUuid: "attr-uuid", type, config };
}

describe("normalizeParticipantAttributeValue", () => {
  const mockPrismaBlock = {
    count: jest.fn(),
  };
  const mockPrisma = {
    block: mockPrismaBlock,
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("select", () => {
    it("returns Prisma.JsonNull for missing values", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.select, { options: ["a", "b"] }),
          "",
        ),
      ).resolves.toBe(Prisma.JsonNull);
    });

    it("throws for non-string values", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.select, { options: ["a"] }),
          42,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws when no options are configured and allowOther is false", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.select, { options: [] }),
          "anything",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("accepts any string when no options are configured but allowOther is true", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.select, { options: [], allowOther: true }),
          "anything",
        ),
      ).resolves.toBe("anything");
    });

    it("throws for a value outside the configured options", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.select, { options: ["a", "b"] }),
          "c",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("allows an out-of-list value when allowOther is true", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.select, {
            options: ["a", "b"],
            allowOther: true,
          }),
          "c",
        ),
      ).resolves.toBe("c");
    });

    it("returns a valid option value", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.select, { options: ["a", "b"] }),
          "a",
        ),
      ).resolves.toBe("a");
    });
  });

  describe("multiSelect", () => {
    it("returns Prisma.JsonNull for missing values (not an empty array)", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.multiSelect, { options: ["a", "b"] }),
          null,
        ),
      ).resolves.toBe(Prisma.JsonNull);
    });

    it("splits a semicolon-separated string and trims values", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.multiSelect, { options: ["a", "b"] }),
          "a; b",
        ),
      ).resolves.toEqual(["a", "b"]);
    });

    it("throws on empty items after trimming", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.multiSelect, { options: ["a", "b"] }),
          "a;;b",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws when no options are configured and allowOther is false", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.multiSelect, { options: [] }),
          ["a"],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("accepts values when no options are configured but allowOther is true", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.multiSelect, {
            options: [],
            allowOther: true,
          }),
          ["a", "b"],
        ),
      ).resolves.toEqual(["a", "b"]);
    });

    it("throws when a value is outside the configured options", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.multiSelect, { options: ["a", "b"] }),
          ["a", "c"],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws when selections exceed maxSelections", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.multiSelect, {
            options: ["a", "b", "c"],
            maxSelections: 2,
          }),
          ["a", "b", "c"],
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("block", () => {
    const validUuidA = "550e8400-e29b-41d4-a716-446655440000";
    const validUuidB = "550e8400-e29b-41d4-a716-446655440001";

    it("returns Prisma.JsonNull for missing values", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.block),
          null,
        ),
      ).resolves.toBe(Prisma.JsonNull);
    });

    it("throws for the literal string 'null' (no longer special-cased as empty)", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.block),
          "null",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaBlock.count).not.toHaveBeenCalled();
    });

    it("throws for malformed UUIDs without querying the database", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.block),
          ["not-a-uuid"],
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaBlock.count).not.toHaveBeenCalled();
    });

    it("throws when selections exceed maxSelections (default 1)", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.block),
          [validUuidA, validUuidB],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("scopes the existence check to the specific attribute, not just the event", async () => {
      mockPrismaBlock.count.mockResolvedValue(1);

      await normalizeParticipantAttributeValue(
        mockPrisma,
        attribute(AttributeType.block),
        [validUuidA],
      );

      expect(mockPrismaBlock.count).toHaveBeenCalledWith({
        where: {
          uuid: { in: [validUuidA] },
          attributeUuid: "attr-uuid",
        },
      });
    });

    it("throws when a block UUID does not exist for the attribute", async () => {
      mockPrismaBlock.count.mockResolvedValue(0);

      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.block),
          [validUuidA],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("returns the normalized block UUIDs when valid", async () => {
      mockPrismaBlock.count.mockResolvedValue(2);

      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.block, { maxSelections: 2 }),
          [validUuidA, validUuidB],
        ),
      ).resolves.toEqual([validUuidA, validUuidB]);
    });
  });

  describe("number", () => {
    it("returns Prisma.JsonNull for missing values", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.number),
          "",
        ),
      ).resolves.toBe(Prisma.JsonNull);
    });

    it("throws for non-numeric strings", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.number),
          "abc",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("parses numeric strings", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.number),
          "42",
        ),
      ).resolves.toBe(42);
    });
  });

  describe("date/datetime", () => {
    it("returns Prisma.JsonNull for missing values", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.date),
          "",
        ),
      ).resolves.toBe(Prisma.JsonNull);
    });

    it("throws for invalid date strings", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.datetime),
          "not-a-date",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("converts a Date instance to an ISO string", async () => {
      const date = new Date("2026-01-01T00:00:00.000Z");
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.date),
          date,
        ),
      ).resolves.toBe(date.toISOString());
    });
  });

  describe("checkbox", () => {
    it("returns Prisma.JsonNull for missing values", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.checkbox),
          "",
        ),
      ).resolves.toBe(Prisma.JsonNull);
    });

    it.each([
      ["true", true],
      ["1", true],
      ["on", true],
      ["false", false],
      ["0", false],
      ["off", false],
    ])("normalizes string %s to %s", async (input, expected) => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.checkbox),
          input,
        ),
      ).resolves.toBe(expected);
    });

    it("throws for unrecognized values", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.checkbox),
          "maybe",
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("email", () => {
    it("returns Prisma.JsonNull for missing values", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.email),
          "",
        ),
      ).resolves.toBe(Prisma.JsonNull);
    });

    it("throws for invalid email formats", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.email),
          "not-an-email",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("accepts a valid email", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.email),
          "person@example.com",
        ),
      ).resolves.toBe("person@example.com");
    });
  });

  describe("tel", () => {
    it("throws for invalid phone formats", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.tel),
          "abc",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("accepts a permissive phone format", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.tel),
          "+1 (555) 123-4567",
        ),
      ).resolves.toBe("+1 (555) 123-4567");
    });
  });

  describe("color", () => {
    it("throws for invalid hex colors", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.color),
          "not-a-color",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("accepts a valid hex color", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.color),
          "#ff00aa",
        ),
      ).resolves.toBe("#ff00aa");
    });
  });

  describe("generic text types", () => {
    it("returns Prisma.JsonNull for missing values", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.text),
          "",
        ),
      ).resolves.toBe(Prisma.JsonNull);
    });

    it("throws for non-string values", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.textArea),
          123,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("returns the string as-is", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.text),
          "hello",
        ),
      ).resolves.toBe("hello");
    });

    it("returns the file key as-is for file attributes", async () => {
      await expect(
        normalizeParticipantAttributeValue(
          mockPrisma,
          attribute(AttributeType.file),
          "some-storage-key",
        ),
      ).resolves.toBe("some-storage-key");
    });
  });
});
