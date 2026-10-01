/**
 * Resuelve las cadenas de conexión aceptando los nombres que crean Neon/Vercel:
 * - Integración Neon de Vercel: DATABASE_URL / DATABASE_URL_UNPOOLED, POSTGRES_PRISMA_URL,
 *   POSTGRES_URL / POSTGRES_URL_NON_POOLING, y las mismas con un prefijo personalizado
 *   (p. ej. STORAGE_DATABASE_URL).
 * - Manual: DATABASE_URL (pooled) + DIRECT_URL (directa).
 * Sin dependencias: lo usan prisma.config.ts, el seed y lib/db.ts.
 */
type Env = Record<string, string | undefined>;

const POOLED = ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"];
const DIRECT = ["DIRECT_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"];

function find(env: Env, names: string[]): string | undefined {
  for (const n of names) if (env[n]) return env[n];
  // Mismo nombre con prefijo (STORAGE_DATABASE_URL, NEON_POSTGRES_URL, …)
  for (const n of names) {
    const key = Object.keys(env).find((k) => k.endsWith(`_${n}`) && env[k]);
    if (key) return env[key];
  }
  return undefined;
}

// Prisma Postgres: db.prisma.io es la conexión directa (pocas conexiones: 10 en el plan gratis);
// pooled.db.prisma.io pasa por PgBouncer (50). La app debe ir por la agrupada y las migraciones por la directa.
const PRISMA_DIRECT_HOST = "@db.prisma.io";
const PRISMA_POOLED_HOST = "@pooled.db.prisma.io";

/** Conexión de la app (pooled si existe; en Prisma Postgres fuerza el host agrupado). */
export function pooledDatabaseUrl(env: Env = process.env): string | undefined {
  return (find(env, POOLED) ?? find(env, DIRECT))?.replace(PRISMA_DIRECT_HOST, PRISMA_POOLED_HOST);
}

/** Conexión directa para migraciones y seed (si no hay, la pooled; en Prisma Postgres, host directo). */
export function directDatabaseUrl(env: Env = process.env): string | undefined {
  return (find(env, DIRECT) ?? find(env, POOLED))?.replace(PRISMA_POOLED_HOST, PRISMA_DIRECT_HOST);
}

export const MISSING_DB_MESSAGE =
  "No hay cadena de conexión a la base de datos. En Vercel: Storage → conecta la base Neon al proyecto " +
  "(crea DATABASE_URL) o añade DATABASE_URL a mano en Settings → Environment Variables, y vuelve a desplegar.";
