"use server";

/** Fotos subidas que no llegaron a guardarse. */
import { db } from "@/lib/db";
import { deleteStoredFiles } from "@/lib/storage";
import { isSafePathname } from "@/lib/upload-rules";

/**
 * Descarta fotos subidas que no llegaron a guardarse (nota, lineal o paso de protocolo): el usuario las quitó o
 * cerró el formulario. Nunca toca archivos que ya pertenecen a un registro.
 */
export async function discardUploadedFiles(input: { pathnames: string[] }): Promise<{ ok: true }> {
  const names = Array.isArray(input?.pathnames) ? input.pathnames.filter((n) => typeof n === "string" && isSafePathname(n)) : [];
  if (names.length === 0) return { ok: true };
  const [usedByNotes, usedByPlanograms, usedBySteps] = await Promise.all([
    db.nightNotePhoto.findMany({ where: { pathname: { in: names } }, select: { pathname: true } }),
    db.planogramPhoto.findMany({ where: { pathname: { in: names } }, select: { pathname: true } }),
    db.protocolStep.findMany({ where: { photoPathname: { in: names } }, select: { photoPathname: true } }),
  ]);
  const usedSet = new Set([...[...usedByNotes, ...usedByPlanograms].map((u) => u.pathname), ...usedBySteps.map((u) => u.photoPathname)]);
  await deleteStoredFiles(names.filter((n) => !usedSet.has(n)));
  return { ok: true };
}
