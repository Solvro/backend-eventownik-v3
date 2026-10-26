import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { ReorderEmailsDto } from "./reorder-emails.dto";

async function errorsFor(payload: object) {
  const errors = await validate(plainToInstance(ReorderEmailsDto, payload));
  return errors.map((error) => error.property);
}

describe("ReorderEmailsDto", () => {
  const first = "11111111-1111-4111-8111-111111111111";
  const second = "22222222-2222-4222-8222-222222222222";

  it("accepts a list of unique UUIDs", async () => {
    expect(await errorsFor({ emailIds: [first, second] })).toEqual([]);
  });

  it("rejects an empty list", async () => {
    expect(await errorsFor({ emailIds: [] })).toContain("emailIds");
  });

  it("rejects duplicate ids", async () => {
    expect(await errorsFor({ emailIds: [first, first] })).toContain("emailIds");
  });

  it("rejects ids that are not UUIDs", async () => {
    expect(await errorsFor({ emailIds: [first, "nope"] })).toContain(
      "emailIds",
    );
  });

  it("rejects a missing list", async () => {
    expect(await errorsFor({})).toContain("emailIds");
  });
});
