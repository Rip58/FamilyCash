/** Historial de un empleado y listados de notas (Informe → lupa y ficha del empleado; solo servidor). */
import { db } from "./db";
import { fromDbDate, operationalToday } from "./dates";
import { absenceHistoryItem, entryHistoryItems, mergeAbsenceItems } from "./employee-history-entry";
import { type HistoryItem, meetingHistoryItem, noteHistoryItem, pastHistoryOnly } from "./employee-history";
import { findMeetingTopics } from "./meeting-queries";
import { meetingWho } from "./meetings";
import { findNotes, notesOfEmployee } from "./note-queries";
import { noteWho } from "./notes";
import { getEmployees, getSettings, getStatusTypes, toEntryLite } from "./queries";
import { getEffectiveDay } from "./schedule";

export async function loadEmployeeHistory(employeeId: string): Promise<HistoryItem[]> {
  const [employees, statusTypes, settings, entries, notes, absences, meetings] = await Promise.all([
    getEmployees(),
    getStatusTypes(),
    getSettings(),
    db.dayEntry.findMany({ where: { employeeId }, include: { segments: { orderBy: { sortOrder: "asc" } } } }),
    findNotes(notesOfEmployee(employeeId)),
    db.absence.findMany({ where: { employeeId }, orderBy: { date: "asc" } }),
    findMeetingTopics({ employeeId }),
  ]);
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
  for (const n of notes) {
    // Nota para varias personas: que se vea con quién más.
    const group = n.employeeIds.length > 1 ? `Varios: ${n.employeeName}` : null;
    items.push(noteHistoryItem(n, [group, n.departmentName].filter(Boolean).join(" · ") || null));
  }
  for (const t of meetings) items.push(meetingHistoryItem(t, t.departmentName));
  return pastHistoryOnly(items, operationalToday(new Date(), settings.dayRolloverHour));
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
  const [notes, meetings, settings] = await Promise.all([findNotes(where), findMeetingTopics(where), getSettings()]);
  return pastHistoryOnly([
    ...notes.map((n) => noteHistoryItem(n, scope.kind === "general" ? null : noteWho(n))),
    ...meetings.map((t) => meetingHistoryItem(t, scope.kind === "general" ? null : meetingWho(t).label)),
  ], operationalToday(new Date(), settings.dayRolloverHour));
}
