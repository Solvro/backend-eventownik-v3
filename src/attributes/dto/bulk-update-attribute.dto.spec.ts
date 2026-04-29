import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { AttributeType } from "src/generated/prisma/client";

import { BulkUpdateAttributeDto } from "./bulk-update-attribute.dto";

describe("BulkUpdateAttributeDto", () => {
  it("requires create fields when uuid is missing", () => {
    const dto = plainToInstance(BulkUpdateAttributeDto, {});

    const errors = validateSync(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(["name", "order", "type"]),
    );
  });

  it("allows sparse updates when uuid is present", () => {
    const dto = plainToInstance(BulkUpdateAttributeDto, {
      uuid: "123e4567-e89b-12d3-a456-426614174000",
    });

    const errors = validateSync(dto);

    expect(errors).toHaveLength(0);
  });

  it("accepts a complete create payload without uuid", () => {
    const dto = plainToInstance(BulkUpdateAttributeDto, {
      name: "Label",
      order: 1,
      type: AttributeType.text,
      showInList: true,
      config: {},
    });

    const errors = validateSync(dto);

    expect(errors).toHaveLength(0);
  });
});
