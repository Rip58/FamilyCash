"use server";

/** Server Actions de avisos con foto. */
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { db } from "@/lib/db";
import { operationalToday, toDbDate } from "@/lib/dates";
import { getSettings } from "@/lib/queries";
import {
  type CreateReportInput,
  createReportSchema,
  deleteReportPhotoSchema,
  deleteReportSchema,
  purgeCutoff,
  purgeReportsSchema,
  updateReportSchema,
} from "@/lib/reports";
import { deleteStoredFiles } from "@/lib/storage";
import { isSafePathname } from "@/lib/upload-rules";

export type ReportActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const zodError = (e: z.ZodError) => e.issues[0]?.message ?? "Datos no válidos.";

function revalidate() {
  revalidatePath("/hoy", "layout");
  revalidatePath("/informe", "layout");
  revalidatePath("/avisos");
  revalidatePath("/ajustes/almacenamiento");
}

async function checkRefs(employeeId: string | null, sectionId: string | null): Promise<string | null> {
  if (employeeId && !(await db.employee.findUnique({ where: { id: employeeId }, select: { id: true } }))) {
    return "El empleado no existe.";
  }
  if (sectionId && !(await db.section.findUnique({ where: { id: sectionId }, select: { id: true } }))) {
    return "La sección no existe.";
  }
  return null;
}

export async function createReport(input: CreateReportInput): Promise<ReportActionResult<{ id: string }>> {
  const p = createReportSchema.safeParse(input);
  if (!p.success) {
    // Si el aviso no se puede crear, no dejar fotos huérfanas en el almacenamiento.
    const photos = (input as { photos?: { pathname?: unknown }[] })?.photos;
    if (Array.isArray(photos)) {
      const names = photos.map((x) => x?.pathname).filter((n): n is string => typeof n === "string");
      const safe = names.filter((n) => n.startsWith("reports/") && !n.includes(".."));
      if (safe.length) await deleteStoredFiles(safe);
    }
    return fail(zodError(p.error));
  }
  const d = p.data;
  const refErr = await checkRefs(d.employeeId, d.sectionId);
  if (refErr) {
    await deleteStoredFiles(d.photos.map((x) => x.pathname));
    return fail(refErr);
  }
  try {
    const r = await db.report.create({
      data: {
        date: toDbDate(d.date),
        text: d.text,
        employeeId: d.employeeId,
        sectionId: d.sectionId,
        photos: {
          create: d.photos.map((ph, i) => ({
            url: ph.url,
            pathname: ph.pathname,
            width: ph.width,
            height: ph.height,
            size: ph.size,
            sortOrder: i,
          })),
        },
      },
      select: { id: true },
    });
    revalidate();
    return { ok: true, id: r.id };
  } catch (e) {
    console.error(e);
    return fail("No se pudo guardar el aviso. Inténtalo de nuevo.");
  }
}

export async function updateReport(input: z.input<typeof updateReportSchema>): Promise<ReportActionResult> {
  const p = updateReportSchema.safeParse(input);
  if (!p.success) return fail(zodError(p.error));
  const { id, text, employeeId, sectionId } = p.data;
  const refErr = await checkRefs(employeeId, sectionId);
  if (refErr) return fail(refErr);
  try {
    await db.report.update({ where: { id }, data: { text, employeeId, sectionId } });
  } catch {
    return fail("El aviso ya no existe.");
  }
  revalidate();
  return { ok: true };
}

export async function deleteReport(input: z.input<typeof deleteReportSchema>): Promise<ReportActionResult> {
  const p = deleteReportSchema.safeParse(input);
  if (!p.success) return fail(zodError(p.error));
  const report = await db.report.findUnique({ where: { id: p.data.id }, include: { photos: true } });
  if (!report) return fail("El aviso ya no existe.");
  await db.report.delete({ where: { id: report.id } });
  await deleteStoredFiles(report.photos.map((x) => x.pathname));
  revalidate();
  return { ok: true };
}

export async function deleteReportPhoto(input: z.input<typeof deleteReportPhotoSchema>): Promise<ReportActionResult> {
  const p = deleteReportPhotoSchema.safeParse(input);
  if (!p.success) return fail(zodError(p.error));
  const photo = await db.reportPhoto.findUnique({ where: { id: p.data.photoId } });
  if (!photo) return fail("La foto ya no existe.");
  await db.reportPhoto.delete({ where: { id: photo.id } });
  await deleteStoredFiles([photo.pathname]);
  revalidate();
  return { ok: true };
}

/** Borra avisos (y sus archivos) de noches anteriores a hace N meses. */
export async function purgeOldReports(
  input: z.input<typeof purgeReportsSchema>,
): Promise<ReportActionResult<{ reports: number; photos: number }>> {
  const p = purgeReportsSchema.safeParse(input);
  if (!p.success) return fail("Indica un número de meses válido (1–120).");
  const settings = await getSettings();
  const cutoff = purgeCutoff(operationalToday(new Date(), settings.dayRolloverHour), p.data.months);
  const old = await db.report.findMany({
    where: { date: { lt: toDbDate(cutoff) } },
    select: { id: true, photos: { select: { pathname: true } } },
  });
  if (old.length === 0) return { ok: true, reports: 0, photos: 0 };
  const paths = old.flatMap((r) => r.photos.map((x) => x.pathname));
  await db.report.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });
  await deleteStoredFiles(paths);
  revalidate();
  return { ok: true, reports: old.length, photos: paths.length };
}

/**
 * Descarta fotos subidas que no llegaron a guardarse (aviso, nota de ficha, lineal o paso de protocolo):
 * el usuario las quitó o cerró el formulario. Nunca toca archivos que ya pertenecen a un registro.
 */
export async function discardUploadedFiles(input: { pathnames: string[] }): Promise<ReportActionResult> {
  const names = Array.isArray(input?.pathnames) ? input.pathnames.filter((n) => typeof n === "string" && isSafePathname(n)) : [];
  if (names.length === 0) return { ok: true };
  const [used, usedByNotes, usedByPlanograms, usedBySteps] = await Promise.all([
    db.reportPhoto.findMany({ where: { pathname: { in: names } }, select: { pathname: true } }),
    db.employeeNotePhoto.findMany({ where: { pathname: { in: names } }, select: { pathname: true } }),
    db.planogramPhoto.findMany({ where: { pathname: { in: names } }, select: { pathname: true } }),
    db.protocolStep.findMany({ where: { photoPathname: { in: names } }, select: { photoPathname: true } }),
  ]);
  const usedSet = new Set([
    ...[...used, ...usedByNotes, ...usedByPlanograms].map((u) => u.pathname),
    ...usedBySteps.map((u) => u.photoPathname),
  ]);
  await deleteStoredFiles(names.filter((n) => !usedSet.has(n)));
  return { ok: true };
}
