import "dotenv/config";
import { defineConfig } from "prisma/config";

// Las migraciones usan DIRECT_URL (conexión directa); la app usa DATABASE_URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "" },
});
