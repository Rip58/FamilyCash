/**
 * Restaura una copia JSON (Ajustes → Datos y fotos: «Descargar copia completa» .json o una copia automática .json.gz)
 * en una base de datos VACÍA.
 * Uso: DATABASE_URL="postgres://…" npx tsx scripts/restore-backup.ts familycash-AAAA-MM-DD.json.gz
 * Antes: `npx prisma migrate deploy` contra esa misma base de datos. Ver docs/COPIAS-DE-SEGURIDAD.md.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { parseBackup, restoreBackup } from "../lib/backup";
import { directDatabaseUrl } from "../lib/db-url";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Indica el archivo: npx tsx scripts/restore-backup.ts copia.json");
  const url = directDatabaseUrl();
  if (!url) throw new Error("Falta DATABASE_URL (o DIRECT_URL) de la base de datos destino.");
  const raw = readFileSync(file);
  // Las copias automáticas van comprimidas (gzip: empiezan por 1f 8b).
  const json = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
  const backup = parseBackup(JSON.parse(json));
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const existing = (await db.employee.count()) + (await db.dayEntry.count());
    if (existing > 0 && process.env.FORCE !== "1") {
      throw new Error(
        "La base de datos destino ya tiene empleados o días. Usa una nueva (o FORCE=1 para BORRARLA y restaurar encima).",
      );
    }
    console.log(`Restaurando copia del ${backup.createdAt}…`);
    const counts = await restoreBackup(db, backup);
    console.table(counts);
    console.log("✔ Restauración completa.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(`✖ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
