/** Lectura de notas (solo servidor). */
import { db } from "./db";
import { type DateStr, fromDbDate, toDbDate } from "./dates";
import { type NoteView, noteTypeOf } from "./notes";
import type { Prisma } from "./generated/prisma/client";

const INCLUDE = {
  employee: { select: { name: true } },
  department: { select: { name: true } },
  section: { select: { name: true } },
  photos: { orderBy: { sortOrder: "asc" as const } },
} as const;

type Row = Prisma.NightNoteGetPayload<{ include: typeof INCLUDE }>;

export function toNoteView(r: Row): NoteView {
  return {
    id: r.id,
    date: fromDbDate(r.date),
    time: r.time,
    type: noteTypeOf(r.kind, r.category),
    done: r.doneAt !== null,
    text: r.text,
    employeeId: r.employeeId,
    employeeName: r.employee?.name ?? null,
    departmentId: r.departmentId,
    departmentName: r.department?.name ?? null,
    sectionId: r.sectionId,
    sectionName: r.section?.name ?? null,
    photos: r.photos.map((p) => ({ id: p.id, url: p.url, width: p.width, height: p.height, size: p.size })),
  };
}

const ORDER: Prisma.NightNoteOrderByWithRelationInput[] = [{ date: "asc" }, { time: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }];

export async function findNotes(where: Prisma.NightNoteWhereInput): Promise<NoteView[]> {
  const rows = await db.nightNote.findMany({ where, include: INCLUDE, orderBy: ORDER });
  return rows.map(toNoteView);
}

/** Notas de las noches entre dos fechas incluidas. */
export function getNotes(from: DateStr, to: DateStr): Promise<NoteView[]> {
  return findNotes({ date: { gte: toDbDate(from), lte: toDbDate(to) } });
}

/** Tareas aún sin hacer de noches anteriores a `before`. */
export function getPendingTasksBefore(before: DateStr): Promise<NoteView[]> {
  return findNotes({ kind: "TASK", doneAt: null, date: { lt: toDbDate(before) } });
}

/** Notas y fotos (Ajustes → Datos y fotos). Las fotos de lineales y pasos de protocolo cuentan aparte. */
export async function storageStats() {
  const [notes, photos, planogramPhotos, stepPhotos] = await Promise.all([
    db.nightNote.count(),
    db.nightNotePhoto.aggregate({ _count: { _all: true }, _sum: { size: true } }),
    db.planogramPhoto.aggregate({ _count: { _all: true }, _sum: { size: true } }),
    db.protocolStep.aggregate({ where: { photoPathname: { not: null } }, _count: { _all: true }, _sum: { photoSize: true } }),
  ]);
  const notePhotos = photos._count._all;
  const protocolPhotos = planogramPhotos._count._all + stepPhotos._count._all;
  return {
    notes,
    photos: notePhotos + protocolPhotos,
    notePhotos,
    protocolPhotos,
    bytes: (photos._sum.size ?? 0) + (planogramPhotos._sum.size ?? 0) + (stepPhotos._sum.photoSize ?? 0),
  };
}
