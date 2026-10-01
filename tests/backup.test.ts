import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BACKUP_TABLES, parseBackup } from "@/lib/backup";

describe("copia de seguridad", () => {
  it("incluye todas las tablas del esquema (si añades un modelo, añádelo a BACKUP_TABLES)", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const models = [...schema.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]!.charAt(0).toLowerCase() + m[1]!.slice(1));
    expect([...BACKUP_TABLES].sort()).toEqual(models.sort());
  });
  it("valida el formato", () => {
    const tables = Object.fromEntries(BACKUP_TABLES.map((t) => [t, []]));
    expect(() => parseBackup({ format: "otra-cosa", tables })).toThrow();
    expect(() => parseBackup({ format: "familycash-backup", version: 1, tables: { ...tables, employee: undefined } })).toThrow(/employee/);
    expect(parseBackup({ format: "familycash-backup", version: 1, createdAt: "x", tables }).version).toBe(1);
  });
});
