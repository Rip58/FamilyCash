import "dotenv/config";
import { defineConfig } from "prisma/config";
import { MISSING_DB_MESSAGE, directDatabaseUrl } from "./lib/db-url";

// Las migraciones usan la conexión directa (ver lib/db-url.ts para los nombres aceptados).
// Mensaje claro en el build si falta la conexión (solo cuando se ejecuta en Vercel).
if (process.env.VERCEL && !directDatabaseUrl()) console.error(`\n✖ ${MISSING_DB_MESSAGE}\n`);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: directDatabaseUrl() ?? "" },
});
