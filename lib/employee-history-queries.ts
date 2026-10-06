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
