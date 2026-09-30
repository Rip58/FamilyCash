/**
 * Acceso a datos: carga de Prisma y delega en las funciones puras de
 * lib/schedule.ts. Solo servidor.
 */
import { db } from "./db";
import { type DateStr, fromDbDate, toDbDate, weekDays } from "./dates";
import {
  type DayEntryLite,
  type DayRoster,
  type DepartmentLite,
  type EmployeeLite,
  type StatusTypeLite,
  type WeekGrid,
  getDayRoster,
  getWeekGrid,
} from "./schedule";

export interface SettingsData {
  id: number;
  shiftStart: string;
  shiftEnd: string;
  breakStart: string;
  breakEnd: string;
  dayRolloverHour: number;
  daysOffPerWeek: number;
}

/** Ajustes (fila id=1; se crea con valores por defecto si no existe). */
export async function getSettings(): Promise<SettingsData> {
  // Lectura primero: evita una escritura (upsert) en cada carga de página.
  const s = (await db.settings.findUnique({ where: { id: 1 } })) ?? (await db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }));
  const { passwordHash: _omit, ...rest } = s;
  void _omit;
  return rest;
}

export async function getStatusTypes(): Promise<StatusTypeLite[]> {
  return db.statusType.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] });
}

export async function getDepartments(): Promise<DepartmentLite[]> {
  return db.department.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

export async function getEmployees(): Promise<EmployeeLite[]> {
  return db.employee.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

export async function getSections() {
  return db.section.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

type EntryRow = Awaited<ReturnType<typeof db.dayEntry.findMany<{ include: { segments: true } }>>>[number];

/** Fila de Prisma -> DayEntryLite (fechas "YYYY-MM-DD", tramos ordenados). */
export function toEntryLite(r: EntryRow): DayEntryLite {
  return {
    employeeId: r.employeeId,
    date: fromDbDate(r.date),
    statusTypeId: r.statusTypeId,
    departmentId: r.departmentId,
    reason: r.reason,
    note: r.note,
    arrivedAt: r.arrivedAt,
    leftAt: r.leftAt,
    timeReason: r.timeReason,
    extraMinutes: r.extraMinutes,
    extraNote: r.extraNote,
    segments: [...r.segments]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({
        id: s.id,
        sectionId: s.sectionId,
        label: s.label,
        start: s.start,
        end: s.end,
        note: s.note,
        sortOrder: s.sortOrder,
      })),
  };
}

/** DayEntries (con tramos) entre dos fechas incluidas, ya con fechas "YYYY-MM-DD". */
export async function getEntriesBetween(from: DateStr, to: DateStr): Promise<DayEntryLite[]> {
  const rows = await db.dayEntry.findMany({
    where: { date: { gte: toDbDate(from), lte: toDbDate(to) } },
    include: { segments: { orderBy: { sortOrder: "asc" } } },
  });
  return rows.map(toEntryLite);
}

export async function getDayNote(date: DateStr): Promise<string | null> {
  const n = await db.dayNote.findUnique({ where: { date: toDbDate(date) } });
  return n?.text ?? null;
}

/** Roster de una noche: departamentos, ausentes, vacíos y bajo plazas. */
export async function loadDayRoster(date: DateStr): Promise<DayRoster> {
  const [employees, departments, statusTypes, entries] = await Promise.all([
    getEmployees(),
    getDepartments(),
    getStatusTypes(),
    getEntriesBetween(date, date),
  ]);
  return getDayRoster({ date, employees, entries, departments, statusTypes });
}

/** Cuadrícula empleados x 7 días de la semana que contiene `date`. */
export async function loadWeekGrid(date: DateStr): Promise<WeekGrid> {
  const days = weekDays(date);
  const [settings, employees, departments, statusTypes, entries] = await Promise.all([
    getSettings(),
    getEmployees(),
    getDepartments(),
    getStatusTypes(),
    getEntriesBetween(days[0]!, days[6]!),
  ]);
  return getWeekGrid({
    date,
    employees,
    entries,
    departments,
    statusTypes,
    daysOffPerWeek: settings.daysOffPerWeek,
  });
}
