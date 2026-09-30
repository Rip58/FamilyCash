/** Carga de datos de la ficha del empleado y de las peticiones (solo servidor). */
import { db } from "./db";
import { type DateStr, fromDbDate, toDbDate } from "./dates";
import { isNoteCategory, type NoteView, type RequestView } from "./employee-file";
import { parseAppliedChanges, requestDates, summarizeRequest, type LeaveType } from "./leave";

export async function loadNotes(employeeId: string): Promise<NoteView[]> {
  const rows = await db.employeeNote.findMany({
    where: { employeeId },
    include: { photos: { orderBy: { sortOrder: "asc" } } },
    orderBy: { occurredAt: "desc" },
  });
  return rows.map((n) => ({
    id: n.id,
    occurredAt: n.occurredAt.toISOString(),
    category: isNoteCategory(n.category) ? n.category : "NOTE",
    text: n.text,
    photos: n.photos.map((p) => ({ id: p.id, url: p.url, width: p.width, height: p.height, size: p.size })),
  }));
}

type RequestRow = Awaited<ReturnType<typeof db.leaveRequest.findMany<{ include: { employee: { select: { name: true } } } }>>>[number];

function toRequestView(r: RequestRow): RequestView {
  return {
    id: r.id,
    employeeId: r.employeeId,
    employeeName: r.employee.name,
    type: r.type as LeaveType,
    dateFrom: fromDbDate(r.dateFrom),
    dateTo: fromDbDate(r.dateTo),
    note: r.note,
    requestedAt: fromDbDate(r.requestedAt),
    status: r.status as RequestView["status"],
    decisionNote: r.decisionNote,
    appliedCount: parseAppliedChanges(r.appliedChanges).length,
  };
}

export async function loadRequests(opts: { employeeId?: string; pendingOnly?: boolean } = {}): Promise<RequestView[]> {
  const rows = await db.leaveRequest.findMany({
    where: {
      ...(opts.employeeId ? { employeeId: opts.employeeId } : {}),
      ...(opts.pendingOnly ? { status: "PENDING" } : {}),
    },
    include: { employee: { select: { name: true } } },
    orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toRequestView);
}

export async function countPendingRequests(): Promise<number> {
  return db.leaveRequest.count({ where: { status: "PENDING" } });
}

/**
 * Celdas (empleado|fecha) cubiertas por una petición PENDIENTE en un rango,
 * con un texto corto para la hoja de la cuadrícula.
 */
export async function loadPendingCoverage(from: DateStr, to: DateStr): Promise<Record<string, string>> {
  const rows = await db.leaveRequest.findMany({
    where: {
      status: "PENDING",
      OR: [
        { type: "SWAP_OFF", OR: [{ dateFrom: { gte: toDbDate(from), lte: toDbDate(to) } }, { dateTo: { gte: toDbDate(from), lte: toDbDate(to) } }] },
        { type: { not: "SWAP_OFF" }, dateFrom: { lte: toDbDate(to) }, dateTo: { gte: toDbDate(from) } },
      ],
    },
    select: { employeeId: true, type: true, dateFrom: true, dateTo: true },
  });
  const out: Record<string, string> = {};
  for (const r of rows) {
    const lite = { type: r.type as LeaveType, dateFrom: fromDbDate(r.dateFrom), dateTo: fromDbDate(r.dateTo) };
    const text = summarizeRequest(lite);
    for (const d of requestDates(lite)) {
      if (d < from || d > to) continue;
      const key = `${r.employeeId}|${d}`;
      out[key] = out[key] ? `${out[key]}; ${text}` : text;
    }
  }
  return out;
}
