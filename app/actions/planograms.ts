"use server";

/** Server Actions de lineales (Protocolos → Lineales) y sus ubicaciones (Ajustes → Ubicaciones). */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { toDbDate } from "@/lib/dates";
import {
  type CreatePlanogramInput,
  createPlanogramSchema,
  locationSchema,
  updatePlanogramSchema,
} from "@/lib/planograms";
import { nextSortOrder, sortOrderUpdates } from "@/lib/settings-logic";
import { deleteStoredFiles } from "@/lib/storage";
import { isSafePathname } from "@/lib/upload-rules";

export type PlanogramActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const zodError = (e: z.ZodError) => e.issues[0]?.message ?? "Datos no válidos.";
const idSchema = z.string().min(1).max(64);

function revalidate() {
  revalidatePath("/protocolos/lineales");
  revalidatePath("/ajustes/ubicaciones");
  revalidatePath("/ajustes/datos");
}

async function locationExists(id: string | null): Promise<boolean> {
  return !id || !!(await db.shelfLocation.findUnique({ where: { id }, select: { id: true } }));
}

export async function createPlanogram(input: CreatePlanogramInput): Promise<PlanogramActionResult<{ id: string }>> {
  const p = createPlanogramSchema.safeParse(input);
  if (!p.success) {
    // Si no se puede crear, no dejar fotos huérfanas en el almacenamiento.
    const photos = (input as { photos?: { pathname?: unknown }[] })?.photos;
    if (Array.isArray(photos)) {
      const names = photos.map((x) => x?.pathname).filter((n): n is string => typeof n === "string" && isSafePathname(n));
      if (names.length) await deleteStoredFiles(names);
    }
    return fail(zodError(p.error));
  }
  const d = p.data;
  if (!(await locationExists(d.locationId))) {
    await deleteStoredFiles(d.photos.map((x) => x.pathname));
    return fail("La ubicación ya no existe.");
  }
  try {
    const r = await db.planogram.create({
      data: {
        locationId: d.locationId,
        text: d.text,
        until: d.until ? toDbDate(d.until) : null,
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
    return fail("No se pudo guardar el lineal. Inténtalo de nuevo.");
  }
}

export async function updatePlanogram(input: z.input<typeof updatePlanogramSchema>): Promise<PlanogramActionResult> {
  const p = updatePlanogramSchema.safeParse(input);
  if (!p.success) return fail(zodError(p.error));
  const { id, locationId, text, until } = p.data;
  if (!(await locationExists(locationId))) return fail("La ubicación ya no existe.");
  try {
    await db.planogram.update({ where: { id }, data: { locationId, text, until: until ? toDbDate(until) : null } });
  } catch {
    return fail("El lineal ya no existe.");
  }
  revalidate();
  return { ok: true };
}

export async function deletePlanogram(rawId: string): Promise<PlanogramActionResult> {
  const p = idSchema.safeParse(rawId);
  if (!p.success) return fail("Lineal no válido.");
  const row = await db.planogram.findUnique({ where: { id: p.data }, include: { photos: true } });
  if (!row) return fail("El lineal ya no existe.");
  await db.planogram.delete({ where: { id: row.id } });
  await deleteStoredFiles(row.photos.map((x) => x.pathname));
  revalidate();
  return { ok: true };
}

// ---------------------------------------------------------------- Ubicaciones

export async function saveLocation(input: z.input<typeof locationSchema>): Promise<PlanogramActionResult<{ id: string }>> {
  const p = locationSchema.safeParse(input);
  if (!p.success) return fail(zodError(p.error));
  const { id, ...data } = p.data;
  if (!id) {
    const rows = await db.shelfLocation.findMany({ select: { sortOrder: true } });
    const created = await db.shelfLocation.create({ data: { ...data, sortOrder: nextSortOrder(rows.map((r) => r.sortOrder)) } });
    revalidate();
    return { ok: true, id: created.id };
  }
  try {
    await db.shelfLocation.update({ where: { id }, data });
  } catch {
    return fail("La ubicación ya no existe.");
  }
  revalidate();
  return { ok: true, id };
}

export async function reorderLocations(ids: string[]): Promise<PlanogramActionResult> {
  const p = z.array(idSchema).max(500).safeParse(ids);
  if (!p.success) return fail("Datos no válidos.");
  await db.$transaction(
    sortOrderUpdates(p.data).map((u) => db.shelfLocation.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } })),
  );
  revalidate();
  return { ok: true };
}

export async function deleteLocation(rawId: string): Promise<PlanogramActionResult> {
  const p = idSchema.safeParse(rawId);
  if (!p.success) return fail("Ubicación no válida.");
  const used = await db.planogram.count({ where: { locationId: p.data } });
  if (used > 0) return fail("Tiene lineales: bórralos antes o desactiva la ubicación.");
  await db.shelfLocation.deleteMany({ where: { id: p.data } });
  revalidate();
  return { ok: true };
}
