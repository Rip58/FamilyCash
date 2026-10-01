/** Lecturas de lineales, ubicaciones y pasos de protocolo (solo servidor). */
import "server-only";
import { db } from "./db";
import { fromDbDate, madridParts } from "./dates";
import type { LocationOption, PlanogramView, ProtocolStepView } from "./planograms";

type StepRow = {
  id: string;
  text: string;
  photoUrl: string | null;
  photoPathname: string | null;
  photoWidth: number | null;
  photoHeight: number | null;
  photoSize: number;
};

export const stepSelect = {
  id: true,
  text: true,
  photoUrl: true,
  photoPathname: true,
  photoWidth: true,
  photoHeight: true,
  photoSize: true,
} as const;

export function toStepView(r: StepRow): ProtocolStepView {
  const photo =
    r.photoUrl && r.photoPathname && r.photoWidth && r.photoHeight
      ? { url: r.photoUrl, pathname: r.photoPathname, width: r.photoWidth, height: r.photoHeight, size: r.photoSize }
      : null;
  return { id: r.id, text: r.text, photo };
}

/** Ubicaciones en su orden (todas: las inactivas se muestran solo si tienen lineales). */
export async function getLocations(): Promise<LocationOption[]> {
  return db.shelfLocation.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, active: true },
  });
}

/** Todos los lineales, del más nuevo al más antiguo. */
export async function getPlanograms(): Promise<PlanogramView[]> {
  const rows = await db.planogram.findMany({
    orderBy: { createdAt: "desc" },
    include: { location: { select: { name: true } }, photos: { orderBy: { sortOrder: "asc" } } },
  });
  return rows.map((r) => ({
    id: r.id,
    locationId: r.locationId,
    locationName: r.location?.name ?? null,
    text: r.text,
    until: r.until ? fromDbDate(r.until) : null,
    createdDate: madridParts(r.createdAt).date,
    photos: r.photos.map((p) => ({ id: p.id, url: p.url, width: p.width, height: p.height, size: p.size })),
  }));
}
