/**
 * Almacenamiento de fotos (solo servidor). Las fotos siempre se suben y se sirven a través de la app
 * (/api/upload/photo y /api/files, con sesión):
 *  - Con Vercel Blob conectado (`blobAuth`): almacén privado.
 *  - Sin Blob (desarrollo): carpeta local `.uploads/`.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";
import { blobAuth } from "./blob-auth";
import { LOCAL_FILES_BASE, UPLOAD_PREFIX, extensionFor, isSafePathname } from "./upload-rules";

export type StorageMode = "blob" | "local";

export function storageMode(): StorageMode {
  return blobAuth() ? "blob" : "local";
}

export const BLOB_MISSING =
  "Falta conectar el almacenamiento de fotos: en Vercel → Storage, crea un Blob y conéctalo al proyecto.";

/** En Vercel sin Blob no se pueden guardar fotos (el disco es de solo lectura). */
export function blobMissing(): boolean {
  return storageMode() === "local" && !!process.env.VERCEL;
}

// turbopackIgnore: carpeta solo de desarrollo; sin esto Turbopack empaqueta todo el proyecto en el servidor.
const ROOT = path.resolve(/* turbopackIgnore: true */ process.cwd(), ".uploads");

/** Ruta absoluta dentro de `.uploads/`, o null si el pathname no es seguro. */
export function localFilePath(pathname: string): string | null {
  if (!isSafePathname(pathname)) return null;
  const full = path.resolve(ROOT, pathname);
  return full.startsWith(ROOT + path.sep) ? full : null;
}

/** Guarda una foto ya validada y devuelve su URL (servida por /api/files) y su pathname. */
export async function saveStoredFile(bytes: Uint8Array, contentType: string): Promise<{ url: string; pathname: string }> {
  const auth = blobAuth();
  if (!auth) return saveLocalFile(bytes, contentType);
  const ext = extensionFor(contentType);
  if (!ext) throw new Error("Formato no admitido.");
  const res = await put(`${UPLOAD_PREFIX}${randomUUID()}.${ext}`, Buffer.from(bytes), {
    access: "private",
    contentType,
    ...auth,
  });
  return { url: `${LOCAL_FILES_BASE}${res.pathname}`, pathname: res.pathname };
}

export async function saveLocalFile(bytes: Uint8Array, contentType: string): Promise<{ url: string; pathname: string }> {
  const ext = extensionFor(contentType);
  if (!ext) throw new Error("Formato no admitido.");
  const pathname = `${UPLOAD_PREFIX}${randomUUID()}.${ext}`;
  const full = localFilePath(pathname);
  if (!full) throw new Error("Ruta no válida.");
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(/* turbopackIgnore: true */ full, bytes);
  return { url: `${LOCAL_FILES_BASE}${pathname}`, pathname };
}

export async function readLocalFile(pathname: string): Promise<Buffer | null> {
  const full = localFilePath(pathname);
  if (!full) return null;
  try {
    return await readFile(/* turbopackIgnore: true */ full);
  } catch {
    return null;
  }
}

/** Lee una foto del almacenamiento (Blob privado o local). null si no existe. */
export async function readStoredFile(pathname: string): Promise<BodyInit | null> {
  if (!isSafePathname(pathname)) return null;
  if (storageMode() === "blob") {
    try {
      const r = await get(pathname, { access: "private", ...blobAuth() });
      return r?.statusCode === 200 ? r.stream : null;
    } catch (e) {
      console.error("No se pudo leer", pathname, e);
      return null;
    }
  }
  const data = await readLocalFile(pathname);
  return data ? new Uint8Array(data) as Uint8Array<ArrayBuffer> : null;
}

/** Borra un archivo del almacenamiento (Blob o local). Tolerante a "no existe". */
export async function deleteStoredFile(pathname: string): Promise<void> {
  if (storageMode() === "blob") {
    // `del` acepta URL o pathname; con pathname busca en el store del token.
    await del(pathname, { ...blobAuth() });
    return;
  }
  const full = localFilePath(pathname);
  if (full) await rm(/* turbopackIgnore: true */ full, { force: true });
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
