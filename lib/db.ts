import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { pooledDatabaseUrl } from "@/lib/db-url";

// Un único cliente por proceso (evita agotar conexiones en dev/HMR).
// Se usa el adaptador estándar `pg` (Prisma 7); funciona igual con Postgres
// local y con Neon (usar la cadena "pooled" en DATABASE_URL).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  // Pocas conexiones por instancia (en Vercel hay varias a la vez). Se mantienen abiertas 2 min: reabrir
  // una conexión (TCP + TLS + login) cuesta ~4 viajes a la BD; el límite real lo pone PgBouncer.
  const adapter = new PrismaPg({
    connectionString: pooledDatabaseUrl(),
    max: 4,
    idleTimeoutMillis: 120_000,
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

export const db: PrismaClient = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
