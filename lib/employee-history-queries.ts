/** Historial de un empleado para Informe → buscar empleado (solo servidor). */
import { db } from "./db";
import { fromDbDate, madridParts } from "./dates";
import { CATEGORY_META, isNoteCategory } from "./employee-file";
import { absenceHistoryItem, entryHistoryItems, mergeAbsenceItems } from "./employee-history-entry";
import { type HistoryItem, KIND_META } from "./employee-history";
import { LEAVE_STATUS_LABEL, type LeaveStatus, type LeaveType, summarizeRequest } from "./leave";
import { getEmployees, getSettings, getStatusTypes, toEntryLite } from "./queries";
import { getEffectiveDay } from "./schedule";

export async function loadEmployeeHistory(employeeId: string): Promise<HistoryItem[]> {
  const [employees, statusTypes, settings, entries, nightNotes, reports, fileNotes, requests] = await Promise.all([
    getEmployees(),
    getStatusTypes(),
    getSettings(),
    db.dayEntry.findMany({ where: { employeeId }, include: { segments: { orderBy: { sortOrder: "asc" } } } }),
    db.nightNote.findMany({ where: { employeeId }, orderBy: { createdAt: "asc" } }),
    db.report.findMany({ where: { employeeId }, include: { photos: { select: { id: true } } }, orderBy: { createdAt: "asc" } }),
    db.employeeNote.findMany({ where: { employeeId }, include: { photos: { select: { id: true } } }, orderBy: { occurredAt: "asc" } }),
    db.leaveRequest.findMany({ where: { employeeId }, orderBy: { createdAt: "asc" } }),
  ]);
  const absences = await db.absence.findMany({ where: { employeeId }, orderBy: { date: "asc" } });
  const employee = employees.find((e) => e.id === employeeId);
  if (!employee) return [];

  const dayItems: HistoryItem[] = [];
  for (const row of entries) {
    const entry = toEntryLite(row);
    dayItems.push(...entryHistoryItems(getEffectiveDay(employee, entry.date, entry, statusTypes), settings));
  }
  // Faltas del registro: siguen saliendo aunque después el día se cambiara a fiesta.
  const items = mergeAbsenceItems(
    dayItems,
    absences.map((a) => absenceHistoryItem({ ...a, date: fromDbDate(a.date) })),
  );
  for (const n of nightNotes) {
    const task = n.kind === "TASK";
    items.push({
      date: fromDbDate(n.date),
      kind: task ? "task" : "night-note",
      label: task ? (n.doneAt ? "Tarea hecha" : "Tarea pendiente") : "Nota",
      text: n.text,
      color: KIND_META[task ? "task" : "night-note"].color,
    });
  }
  for (const r of reports) {
    items.push({ date: fromDbDate(r.date), kind: "report", label: "Aviso", text: r.text, color: KIND_META.report.color, photos: r.photos.length });
  }
  for (const n of fileNotes) {
    const at = madridParts(n.occurredAt);
    const meta = CATEGORY_META[isNoteCategory(n.category) ? n.category : "NOTE"];
    items.push({
      date: at.date,
      time: `${String(at.hour).padStart(2, "0")}:${String(at.minute).padStart(2, "0")}`,
      ref: { type: "file-note", id: n.id },
      kind: "file-note",
      label: meta.label,
      text: n.text,
      color: meta.color,
      photos: n.photos.length,
    });
  }
  for (const r of requests) {
    const lite = { type: r.type as LeaveType, dateFrom: fromDbDate(r.dateFrom), dateTo: fromDbDate(r.dateTo) };
    const status = LEAVE_STATUS_LABEL[r.status as LeaveStatus] ?? r.status;
    items.push({
      date: fromDbDate(r.requestedAt),
      kind: "request",
      label: `Petición ${status.toLowerCase()}`,
      text: `${summarizeRequest(lite)}${r.note ? ` — ${r.note}` : ""}${r.decisionNote ? ` (respuesta: ${r.decisionNote})` : ""}`,
      color: KIND_META.request.color,
    });
  }
  return items;
}

/** Listados de notas que no son de una persona: todas, las generales o las de un departamento. */
export type NotesScope = { kind: "all" } | { kind: "general" } | { kind: "department"; departmentId: string };

export async function loadNotesHistory(scope: NotesScope): Promise<HistoryItem[]> {
  const where =
    scope.kind === "general"
      ? { employeeId: null, departmentId: null }
      : scope.kind === "department"
        ? { departmentId: scope.departmentId }
        : {};
  const [nightNotes, dayNotes, entryNotes, reports] = await Promise.all([
    db.nightNote.findMany({
      where,
      include: { employee: { select: { name: true } }, department: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    scope.kind === "department" ? Promise.resolve([]) : db.dayNote.findMany(),
    scope.kind === "all"
      ? db.dayEntry.findMany({ where: { note: { not: null } }, select: { date: true, note: true, employee: { select: { name: true } } } })
      : Promise.resolve([]),
    scope.kind === "all"
      ? db.report.findMany({ include: { photos: { select: { id: true } }, employee: { select: { name: true } } }, orderBy: { createdAt: "asc" } })
      : Promise.resolve([]),
  ]);
  const items: HistoryItem[] = [];
  for (const d of dayNotes) {
    if (d.text.trim()) items.push({ date: fromDbDate(d.date), kind: "day-note", label: "Nota del día", text: d.text.trim(), color: KIND_META["day-note"].color, who: scope.kind === "all" ? "General" : null });
  }
  for (const n of nightNotes) {
    const task = n.kind === "TASK";
    const who = [n.employee?.name, n.department?.name].filter(Boolean).join(" · ") || "General";
    items.push({
      date: fromDbDate(n.date),
      kind: task ? "task" : "night-note",
      label: task ? (n.doneAt ? "Tarea hecha" : "Tarea pendiente") : "Nota",
      text: n.text,
      color: KIND_META[task ? "task" : "night-note"].color,
      who: scope.kind === "general" ? null : who,
    });
  }
  for (const e of entryNotes) {
    if (e.note?.trim()) items.push({ date: fromDbDate(e.date), kind: "day-note", label: "Nota del día", text: e.note.trim(), color: KIND_META["day-note"].color, who: e.employee.name });
  }
  for (const r of reports) {
    items.push({ date: fromDbDate(r.date), kind: "report", label: "Aviso", text: r.text, color: KIND_META.report.color, photos: r.photos.length, who: r.employee?.name ?? "General" });
  }
  return items;
}
