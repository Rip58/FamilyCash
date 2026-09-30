/**
 * Almacenamiento de fotos (solo servidor).
 *  - Con BLOB_READ_WRITE_TOKEN: Vercel Blob.
 *  - Sin token (desarrollo): carpeta local `.uploads/`, servida por /api/files.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del } from "@vercel/blob";
import { LOCAL_FILES_BASE, UPLOAD_PREFIX, extensionFor, isSafePathname } from "./upload-rules";

export type StorageMode = "blob" | "local";

export function storageMode(): StorageMode {
  return process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local";
}

const ROOT = path.resolve(process.cwd(), ".uploads");

/** Ruta absoluta dentro de `.uploads/`, o null si el pathname no es seguro. */
export function localFilePath(pathname: string): string | null {
  if (!isSafePathname(pathname)) return null;
  const full = path.resolve(ROOT, pathname);
  return full.startsWith(ROOT + path.sep) ? full : null;
}

export async function saveLocalFile(bytes: Uint8Array, contentType: string): Promise<{ url: string; pathname: string }> {
  const ext = extensionFor(contentType);
  if (!ext) throw new Error("Formato no admitido.");
  const pathname = `${UPLOAD_PREFIX}${randomUUID()}.${ext}`;
  const full = localFilePath(pathname);
  if (!full) throw new Error("Ruta no válida.");
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
  return { url: `${LOCAL_FILES_BASE}${pathname}`, pathname };
}

export async function readLocalFile(pathname: string): Promise<Buffer | null> {
  const full = localFilePath(pathname);
  if (!full) return null;
  try {
    return await readFile(full);
  } catch {
    return null;
  }
}

/** Borra un archivo del almacenamiento (Blob o local). Tolerante a "no existe". */
export async function deleteStoredFile(pathname: string): Promise<void> {
  if (storageMode() === "blob") {
    // `del` acepta URL o pathname; con pathname busca en el store del token.
    await del(pathname);
    return;
  }
  const full = localFilePath(pathname);
  if (full) await rm(full, { force: true });
}

/** Borra varios archivos sin que un fallo impida borrar el resto. Devuelve los fallidos. */
export async function deleteStoredFiles(pathnames: string[]): Promise<string[]> {
  const failed: string[] = [];
  for (const p of pathnames) {
    try {
      await deleteStoredFile(p);
    } catch (e) {
      console.error("No se pudo borrar", p, e);
      failed.push(p);
    }
  }
  return failed;
}
