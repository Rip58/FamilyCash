/** Carga de avisos con foto (solo servidor). */
import { db } from "./db";
import { type DateStr, fromDbDate, madridParts, toDbDate } from "./dates";
import type { ReportView } from "./reports";

const INCLUDE = {
  photos: { orderBy: { sortOrder: "asc" as const } },
  employee: { select: { name: true } },
  section: { select: { name: true } },
};

type Row = Awaited<ReturnType<typeof db.report.findMany<{ include: typeof INCLUDE }>>>[number];

function toView(r: Row): ReportView {
  const created = madridParts(r.createdAt);
  return {
    id: r.id,
    date: fromDbDate(r.date),
    text: r.text,
    employeeId: r.employeeId,
    employeeName: r.employee?.name ?? null,
    sectionId: r.sectionId,
    sectionName: r.section?.name ?? null,
    createdTime: `${String(created.hour).padStart(2, "0")}:${String(created.minute).padStart(2, "0")}`,
    createdDate: created.date,
    photos: r.photos.map((p) => ({ id: p.id, url: p.url, width: p.width, height: p.height, size: p.size })),
  };
}

/** Avisos de una noche, en orden de creación. */
export async function getReportsForDate(date: DateStr): Promise<ReportView[]> {
  const rows = await db.report.findMany({
    where: { date: toDbDate(date) },
    include: INCLUDE,
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toView);
}

export interface ReportFilter {
  from?: DateStr;
  to?: DateStr;
  employeeId?: string;
}

/** Listado paginado (más recientes primero). */
export async function listReports(filter: ReportFilter, page: number, pageSize: number) {
  const where = {
    ...(filter.from || filter.to
      ? { date: { ...(filter.from ? { gte: toDbDate(filter.from) } : {}), ...(filter.to ? { lte: toDbDate(filter.to) } : {}) } }
      : {}),
    ...(filter.employeeId ? { employeeId: filter.employeeId } : {}),
  };
  const [total, rows] = await Promise.all([
    db.report.count({ where }),
    db.report.findMany({
      where,
      include: INCLUDE,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { total, reports: rows.map(toView) };
}

/** Todos los avisos en los que aparece un empleado (más recientes primero). */
export async function listReportsForEmployee(employeeId: string): Promise<ReportView[]> {
  const rows = await db.report.findMany({
    where: { employeeId },
    include: INCLUDE,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toView);
}

/** Avisos y fotos de avisos + notas de ficha y sus fotos (para Ajustes → Almacenamiento). */
export async function storageStats() {
  const [reports, photos, notes, notePhotos, planogramPhotos, stepPhotos] = await Promise.all([
    db.report.count(),
    db.reportPhoto.aggregate({ _count: { _all: true }, _sum: { size: true } }),
    db.employeeNote.count(),
    db.employeeNotePhoto.aggregate({ _count: { _all: true }, _sum: { size: true } }),
    db.planogramPhoto.aggregate({ _count: { _all: true }, _sum: { size: true } }),
    db.protocolStep.aggregate({ where: { photoPathname: { not: null } }, _count: { _all: true }, _sum: { photoSize: true } }),
  ]);
  const reportPhotos = photos._count._all;
  const filePhotos = notePhotos._count._all;
  const protocolPhotos = planogramPhotos._count._all + stepPhotos._count._all;
  return {
    reports,
    notes,
    photos: reportPhotos + filePhotos + protocolPhotos,
    reportPhotos,
    notePhotos: filePhotos,
    protocolPhotos,
    bytes:
      (photos._sum.size ?? 0) +
      (notePhotos._sum.size ?? 0) +
      (planogramPhotos._sum.size ?? 0) +
      (stepPhotos._sum.photoSize ?? 0),
  };
}
