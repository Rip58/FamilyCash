import { describe, expect, it } from "vitest";
import { directDatabaseUrl, pooledDatabaseUrl } from "@/lib/db-url";

describe("db-url", () => {
  it("manual: DATABASE_URL + DIRECT_URL", () => {
    const env = { DATABASE_URL: "pooled", DIRECT_URL: "direct" };
    expect(pooledDatabaseUrl(env)).toBe("pooled");
    expect(directDatabaseUrl(env)).toBe("direct");
  });
  it("integración Neon de Vercel", () => {
    const env = { DATABASE_URL: "pooled", DATABASE_URL_UNPOOLED: "direct" };
    expect(directDatabaseUrl(env)).toBe("direct");
  });
  it("nombres POSTGRES_* y con prefijo", () => {
    expect(pooledDatabaseUrl({ POSTGRES_PRISMA_URL: "p", POSTGRES_URL_NON_POOLING: "d" })).toBe("p");
    expect(directDatabaseUrl({ POSTGRES_PRISMA_URL: "p", POSTGRES_URL_NON_POOLING: "d" })).toBe("d");
    expect(pooledDatabaseUrl({ STORAGE_DATABASE_URL: "sp" })).toBe("sp");
    expect(directDatabaseUrl({ STORAGE_DATABASE_URL: "sp", STORAGE_DATABASE_URL_UNPOOLED: "sd" })).toBe("sd");
  });
  it("Prisma Postgres: la app va por el host agrupado y las migraciones por el directo", () => {
    const direct = "postgres://u:p@db.prisma.io:5432/postgres?sslmode=require";
    const pooled = "postgres://u:p@pooled.db.prisma.io:5432/postgres?sslmode=require";
    expect(pooledDatabaseUrl({ x_PRISMA_DATABASE_URL: direct, x_POSTGRES_URL: direct })).toBe(pooled);
    expect(directDatabaseUrl({ x_POSTGRES_URL: direct })).toBe(direct);
    expect(directDatabaseUrl({ DATABASE_URL: pooled })).toBe(direct);
    // otros proveedores no se tocan
    expect(pooledDatabaseUrl({ DATABASE_URL: "postgres://u:p@ep-x.neon.tech/db" })).toBe("postgres://u:p@ep-x.neon.tech/db");
  });
  it("sin nada", () => {
    expect(pooledDatabaseUrl({})).toBeUndefined();
    expect(directDatabaseUrl({})).toBeUndefined();
  });
});
