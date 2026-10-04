/**
 * Acceso a datos: carga de Prisma y delega en las funciones puras de
 * lib/schedule.ts. Solo servidor.
 */
import { unstable_cache } from "next/cache";
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
  aiProvider: string;
  /** Modelo elegido para cada IA (sin clave = el de por defecto). */
  aiModels: Partial<Record<string, string>>;
}

/**
 * Datos de referencia (ajustes, estados, departamentos, empleados, secciones): cambian poco,
 * así que se cachean en el servidor y se invalidan con `updateTag(REF_TAG)` en app/actions/settings.ts.
 * El `revalidate` es una red de seguridad por si algo los cambia por otro camino.
 */
export const REF_TAG = "ref";
/** Súbelo si una migración cambia estos datos, para no servir la caché anterior tras el despliegue. */
const REF_CACHE_VERSION = "ref-v6";
const refCache = <T>(fn: () => Promise<T>, key: string) =>
  unstable_cache(fn, [REF_CACHE_VERSION, key], { tags: [REF_TAG], revalidate: 300 });

/** Ajustes (fila id=1; se crea con valores por defecto si no existe). */
export const getSettings = refCache(async (): Promise<SettingsData> => {
  // Lectura primero: evita una escritura (upsert) en cada carga de página.
  const s = (await db.settings.findUnique({ where: { id: 1 } })) ?? (await db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }));
  const { passwordHash: _omit, aiModels, ...rest } = s;
  void _omit;
  const models: Partial<Record<string, string>> = {};
  if (aiModels && typeof aiModels === "object" && !Array.isArray(aiModels)) {
    for (const [k, v] of Object.entries(aiModels)) if (typeof v === "string" && v) models[k] = v;
  }
  return { ...rest, aiModels: models };
}, "settings");

export const getStatusTypes = refCache(
  (): Promise<StatusTypeLite[]> => db.statusType.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
  "statusTypes",
);

export const getDepartments = refCache(
  (): Promise<DepartmentLite[]> => db.department.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  "departments",
);

export const getEmployees = refCache(
  (): Promise<EmployeeLite[]> => db.employee.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  "employees",
);

export const getSections = refCache(
  () => db.section.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  "sections",
);

type EntryRow = Awaited<ReturnType<typeof db.dayEntry.findMany<{ include: { segments: true } }>>>[number];

/** Fila de Prisma -> DayEntryLite (fechas "YYYY-MM-DD", tramos ordenados). */
export function toEntryLite(r: EntryRow): DayEntryLite {
  return {
    employeeId: r.employeeId,
    date: fromDbDate(r.date),
    statusTypeId: r.statusTypeId,
    departmentId: r.departmentId,
    extraDepartmentIds: r.extraDepartmentIds,
    reason: r.reason,
    note: r.note,
    arrivedAt: r.arrivedAt,
    leftAt: r.leftAt,
    timeReason: r.timeReason,
    extraMinutes: r.extraMinutes,
    present: r.present,
    actualStatusTypeId: r.actualStatusTypeId,
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

const NOTE_INCLUDE = { employee: { select: { name: true } }, department: { select: { name: true } } } as const;
type NoteRow = Awaited<ReturnType<typeof db.nightNote.findMany<{ include: typeof NOTE_INCLUDE }>>>[number];

function toNoteView(r: NoteRow) {
  return {
    id: r.id,
    date: fromDbDate(r.date),
    employeeId: r.employeeId,
    name: r.employee?.name ?? null,
    department: r.department?.name ?? null,
    isTask: r.kind === "TASK",
    done: r.doneAt !== null,
    text: r.text,
  };
}

/** Notas de la noche (Informe) entre dos fechas incluidas, en orden de creación. */
export async function getNightNotes(from: DateStr, to: DateStr) {
  const rows = await db.nightNote.findMany({
    where: { date: { gte: toDbDate(from), lte: toDbDate(to) } },
    include: NOTE_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toNoteView);
}

/** Tareas aún sin hacer de noches anteriores a `before`. */
export async function getPendingTasksBefore(before: DateStr) {
  const rows = await db.nightNote.findMany({
    where: { kind: "TASK", doneAt: null, date: { lt: toDbDate(before) } },
    include: NOTE_INCLUDE,
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toNoteView);
}

export async function getDayNotesBetween(from: DateStr, to: DateStr): Promise<{ date: DateStr; text: string }[]> {
  const rows = await db.dayNote.findMany({ where: { date: { gte: toDbDate(from), lte: toDbDate(to) } } });
  return rows.filter((r) => r.text.trim()).map((r) => ({ date: fromDbDate(r.date), text: r.text.trim() }));
}
