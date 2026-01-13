import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// eslint-disable-next-line import/no-default-export
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
