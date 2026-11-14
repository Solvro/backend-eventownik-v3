import { Transform } from "class-transformer";

import { normalizeEmail } from "../utils/noramlize-email";

export const NormalizedEmail = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? normalizeEmail(value) : value,
  );
