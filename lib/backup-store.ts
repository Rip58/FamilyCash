/**
 * Copias automáticas de la base de datos guardadas en el MISMO almacén privado que las fotos (Vercel Blob, o
 * `.uploads/backups/` en desarrollo): una por día, JSON comprimido (gzip), se conservan `KEEP_BACKUPS` días.
 * La hace el cron de Vercel (`/api/cron/backup`, vercel.json) o el botón «Hacer copia ahora» (Ajustes → Datos y fotos).
 */
import "server-only";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { del, get, list, put } from "@vercel/blob";
import { BACKUP_NAME_RE as NAME_RE, backupName, exportBackup, isBackupName } from "./backup";

export { backupName, isBackupName };
import { blobAuth } from "./blob-auth";
import { madridToday } from "./dates";
import { db } from "./db";

export const BACKUP_PREFIX = "backups/";
export const KEEP_BACKUPS = 60;

export interface StoredBackup {
  name: string;
  /** Día (Madrid) de la copia. */
  date: string;
  size: number;
}


const LOCAL_DIR = path.resolve(/* turbopackIgnore: true */ process.cwd(), ".uploads", "backups");

/** Copias guardadas, de la más reciente a la más antigua. */
export async function listBackups(): Promise<StoredBackup[]> {
  const auth = blobAuth();
  let items: { name: string; size: number }[];
  if (auth) {
    const r = await list({ prefix: BACKUP_PREFIX, limit: 1000, ...auth });
    items = r.blobs.map((b) => ({ name: b.pathname.slice(BACKUP_PREFIX.length), size: b.size }));
  } else {
    const names = await readdir(LOCAL_DIR).catch(() => [] as string[]);
    items = await Promise.all(
      names.map(async (name) => ({ name, size: (await stat(path.join(LOCAL_DIR, name))).size })),
    );
  }
  return items
    .flatMap((i) => {
      const m = NAME_RE.exec(i.name);
      return m ? [{ name: i.name, date: m[1]!, size: i.size }] : [];
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Contenido (gzip) de una copia, o null si no existe. */
export async function readBackup(name: string): Promise<Uint8Array | ReadableStream | null> {
  if (!isBackupName(name)) return null;
  const auth = blobAuth();
  if (auth) {
    const r = await get(`${BACKUP_PREFIX}${name}`, { access: "private", ...auth }).catch(() => null);
    return r?.statusCode === 200 ? r.stream : null;
  }
  return readFile(path.join(LOCAL_DIR, name))
    .then((b) => new Uint8Array(b))
    .catch(() => null);
}

/**
 * Hace la copia de hoy (la sobrescribe si ya existe) y borra las que pasan de `KEEP_BACKUPS`.
 * `onlyIfMissing`: no hace nada si la de hoy ya está (para el cron).
 */
export async function saveBackup(opts: { onlyIfMissing?: boolean } = {}): Promise<{ created: boolean; backup: StoredBackup; removed: number }> {
  const date = madridToday();
  const name = backupName(date);
  const before = await listBackups();
  const existing = before.find((b) => b.name === name);
  if (opts.onlyIfMissing && existing) return { created: false, backup: existing, removed: 0 };

  const data = gzipSync(Buffer.from(JSON.stringify(await exportBackup(db))));
  const auth = blobAuth();
  if (auth) {
    await put(`${BACKUP_PREFIX}${name}`, data, {
      access: "private",
      contentType: "application/gzip",
      addRandomSuffix: false,
      allowOverwrite: true,
      ...auth,
    });
  } else {
    await mkdir(LOCAL_DIR, { recursive: true });
    await writeFile(path.join(LOCAL_DIR, name), data);
  }

  const old = [{ name, date, size: data.length }, ...before.filter((b) => b.name !== name)].slice(KEEP_BACKUPS);
  for (const b of old) {
    try {
      if (auth) await del(`${BACKUP_PREFIX}${b.name}`, { ...auth });
      else await rm(path.join(LOCAL_DIR, b.name), { force: true });
    } catch (e) {
      console.error("No se pudo borrar la copia", b.name, e);
    }
  }
  return { created: true, backup: { name, date, size: data.length }, removed: old.length };
}
