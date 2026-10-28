import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { FormSubmitionDto } from "./form-submition.dto";

describe("FormSubmitionDto", () => {
  const validPayload = {
    attributes: [],
    "cf-turnstile-response": "token",
  };

  it("accepts a payload with a turnstile token", async () => {
    const errors = await validate(
      plainToInstance(FormSubmitionDto, validPayload),
    );

    expect(errors).toHaveLength(0);
  });

  it("rejects a payload without a turnstile token", async () => {
    const errors = await validate(
      plainToInstance(FormSubmitionDto, { attributes: [] }),
    );

    expect(errors.map((error) => error.property)).toContain(
      "cf-turnstile-response",
    );
  });
});
