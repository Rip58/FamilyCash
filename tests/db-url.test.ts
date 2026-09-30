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
  it("sin nada", () => {
    expect(pooledDatabaseUrl({})).toBeUndefined();
    expect(directDatabaseUrl({})).toBeUndefined();
  });
});
