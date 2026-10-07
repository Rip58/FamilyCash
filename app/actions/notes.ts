"use server";

/** Server Actions de LA nota (NightNote): crear/editar con fotos, borrar, tarea hecha y limpieza de fotos antiguas. */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { operationalToday, toDbDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { noteTypeToDb } from "@/lib/notes";
import { type SaveNoteInput, saveNoteSchema } from "@/lib/notes-schema";
import { getSettings } from "@/lib/queries";
import { purgeCutoff } from "@/lib/report-format";
import { deleteStoredFiles } from "@/lib/storage";
import { MAX_PHOTOS_PER_REPORT } from "@/lib/upload-rules";

export type NoteActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const idSchema = z.string().min(1).max(64);

function revalidate() {
  revalidatePath("/hoy", "layout");
  revalidatePath("/informe", "layout");
  revalidatePath("/semana", "layout");
  revalidatePath("/ajustes", "layout");
}

/** Fotos subidas de una nota que al final no se guarda: fuera del almacenamiento. */
async function discardPhotos(input: unknown) {
  const photos = (input as { photos?: { pathname?: unknown }[] } | null)?.photos;
  if (!Array.isArray(photos)) return;
  const names = photos
    .map((x) => x?.pathname)
    .filter((n): n is string => typeof n === "string" && n.startsWith("reports/") && !n.includes(".."));
  if (names.length) await deleteStoredFiles(names);
}

async function checkRefs(d: { employeeId: string | null; departmentId: string | null; sectionId: string | null }) {
  const [e, dep, s] = await Promise.all([
    d.employeeId ? db.employee.findUnique({ where: { id: d.employeeId }, select: { id: true } }) : true,
    d.departmentId ? db.department.findUnique({ where: { id: d.departmentId }, select: { id: true } }) : true,
    d.sectionId ? db.section.findUnique({ where: { id: d.sectionId }, select: { id: true } }) : true,
  ]);
  if (!e) return "Empleado no encontrado.";
  if (!dep) return "Departamento no encontrado.";
  if (!s) return "Sección no encontrada.";
  return null;
}

/** Crea o edita una nota. `photos` son fotos nuevas que se añaden a las que ya tenga. */
export async function saveNote(input: SaveNoteInput): Promise<NoteActionResult<{ id: string }>> {
  const p = saveNoteSchema.safeParse(input);
  if (!p.success) {
    await discardPhotos(input);
    return fail(p.error.issues[0]?.message ?? "Datos no válidos.");
  }
  const { id, date, type, photos, ...rest } = p.data;
  const refErr = await checkRefs(rest);
  if (refErr) {
    await discardPhotos(p.data);
    return fail(refErr);
  }
  const { kind, category } = noteTypeToDb(type);
  const fields = { date: toDbDate(date), kind, category, ...rest };
  try {
    if (!id) {
      const n = await db.nightNote.create({
        data: { ...fields, photos: { create: photos.map((ph, i) => ({ ...ph, sortOrder: i })) } },
        select: { id: true },
      });
      revalidate();
      return { ok: true, id: n.id };
    }
    const prev = await db.nightNote.findUnique({ where: { id }, include: { photos: { select: { sortOrder: true } } } });
    if (!prev) {
      await discardPhotos(p.data);
      return fail("La nota ya no existe.");
    }
    if (prev.photos.length + photos.length > MAX_PHOTOS_PER_REPORT) {
      await discardPhotos(p.data);
      return fail(`Máximo ${MAX_PHOTOS_PER_REPORT} fotos por nota.`);
    }
    const start = prev.photos.reduce((m, x) => Math.max(m, x.sortOrder + 1), 0);
    await db.nightNote.update({
      where: { id },
      data: {
        ...fields,
        // Si deja de ser tarea, ya no tiene «hecha».
        ...(kind === "INFO" ? { doneAt: null } : {}),
        photos: { create: photos.map((ph, i) => ({ ...ph, sortOrder: start + i })) },
      },
    });
    revalidate();
    return { ok: true, id };
  } catch (e) {
    console.error(e);
    await discardPhotos(p.data);
    return fail("No se pudo guardar. Inténtalo de nuevo.");
  }
}

/** Borra una nota y sus fotos. */
export async function deleteNote(id: string): Promise<NoteActionResult> {
  const p = idSchema.safeParse(id);
  if (!p.success) return fail("Datos no válidos.");
  const note = await db.nightNote.findUnique({ where: { id: p.data }, include: { photos: { select: { pathname: true } } } });
  if (!note) return { ok: true };
  await db.nightNote.delete({ where: { id: note.id } });
  await deleteStoredFiles(note.photos.map((x) => x.pathname));
  revalidate();
  return { ok: true };
}

/** Quita una foto ya guardada de una nota. */
export async function deleteNotePhoto(photoId: string): Promise<NoteActionResult> {
  const p = idSchema.safeParse(photoId);
  if (!p.success) return fail("Datos no válidos.");
  const photo = await db.nightNotePhoto.findUnique({ where: { id: p.data } });
  if (!photo) return fail("La foto ya no existe.");
  await db.nightNotePhoto.delete({ where: { id: photo.id } });
  await deleteStoredFiles([photo.pathname]);
  revalidate();
  return { ok: true };
}

/** Marca una tarea como hecha o pendiente. */
export async function setNoteDone(input: { id: string; done: boolean }): Promise<NoteActionResult> {
  const p = z.object({ id: idSchema, done: z.boolean() }).safeParse(input);
  if (!p.success) return fail("Datos no válidos.");
  await db.nightNote.updateMany({ where: { id: p.data.id, kind: "TASK" }, data: { doneAt: p.data.done ? new Date() : null } });
  revalidate();
  return { ok: true };
}

/** Borra las FOTOS (no el texto) de las notas de noches anteriores a hace N meses. */
export async function purgeOldNotePhotos(input: { months: number }): Promise<NoteActionResult<{ photos: number }>> {
  const p = z.object({ months: z.number().int().min(1).max(120) }).safeParse(input);
  if (!p.success) return fail("Indica un número de meses válido (1–120).");
  const settings = await getSettings();
  const cutoff = purgeCutoff(operationalToday(new Date(), settings.dayRolloverHour), p.data.months);
  const old = await db.nightNotePhoto.findMany({
    where: { note: { date: { lt: toDbDate(cutoff) } } },
    select: { id: true, pathname: true },
  });
  if (old.length === 0) return { ok: true, photos: 0 };
  await db.nightNotePhoto.deleteMany({ where: { id: { in: old.map((x) => x.id) } } });
  await deleteStoredFiles(old.map((x) => x.pathname));
  revalidate();
  return { ok: true, photos: old.length };
}
