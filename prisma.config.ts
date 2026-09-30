import "dotenv/config";
import { defineConfig } from "prisma/config";

// Las migraciones usan la conexión directa: DIRECT_URL, o DATABASE_URL_UNPOOLED (la que crea
// la integración Neon de Vercel); la app usa DATABASE_URL (pooled).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
});
