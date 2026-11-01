// Prisma 7 CLI config. Prisma no longer loads .env itself, so do it here.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations need a direct or session-mode connection; the app itself may use a transaction pooler.
    url: process.env.DIRECT_DATABASE_URL || env("DATABASE_URL"),
  },
});
