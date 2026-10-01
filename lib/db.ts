import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { pooledDatabaseUrl } from "@/lib/db-url";

// Un único cliente por proceso (evita agotar conexiones en dev/HMR).
// Se usa el adaptador estándar `pg` (Prisma 7); funciona igual con Postgres
// local y con Neon (usar la cadena "pooled" en DATABASE_URL).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  // Pocas conexiones por instancia y se cierran pronto si no se usan: en Vercel hay varias instancias
  // a la vez y todas comparten el límite de conexiones de la base de datos.
  const adapter = new PrismaPg({
    connectionString: pooledDatabaseUrl(),
    max: 4,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

export const db: PrismaClient = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
