/**
 * Lógica pura del cuadrante. FUENTE ÚNICA del "día efectivo" de un empleado.
 * No importa Prisma ni accede a datos (ver lib/queries.ts).
 *
 * Regla del día efectivo:
 *  1. Si hay DayEntry -> se usa.
 *  2. Si no, y el día de la semana está en `fixedDaysOff` -> estado OFF.
 *  3. Si no -> WORK en el departamento habitual.
 *
 * "Día libre" (para el conteo semanal): estado NO trabajando cuyo code es
 * OFF o PAID_OFF. Baja laboral y vacaciones no cuentan como día libre.
 */
import { type DateStr, weekDays, weekdayIndex } from "./dates";

export interface StatusTypeLite {
  id: string;
  code: string;
  label: string;
  color: string;
  isWorking: boolean;
  sortOrder: number;
  active?: boolean;
}

export interface DepartmentLite {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  targetStaff: number;
  active?: boolean;
  /** Secundario (comodín, palets…): si nadie lo cubre no es "sin personal". */
  secondary?: boolean;
}

export interface EmployeeLite {
  id: string;
  name: string;
  alias?: string | null;
  defaultDepartmentId: string | null;
  /** Otros departamentos que cubre habitualmente (además del principal). */
  defaultExtraDepartmentIds?: string[];
  sortOrder: number;
  fixedDaysOff: number[];
  active: boolean;
  notes?: string | null;
  /** Orden de las filas en el Excel del planning (vista Semana sin departamentos). */
  rotaOrder?: number | null;
}

export interface SegmentLite {
  id?: string;
  sectionId: string | null;
  label: string | null;
  start: string;
  end: string;
  note: string | null;
  sortOrder: number;
}

export interface DayEntryLite {
  employeeId: string;
  date: DateStr;
  statusTypeId: string;
  departmentId: string | null;
  /** Otros departamentos que también cubre esa noche (además de `departmentId`). */
  extraDepartmentIds?: string[];
  reason: string | null;
  arrivedAt: string | null;
  leftAt: string | null;
  timeReason: string | null;
  /** Horas extra de la noche en minutos (null/ausente = sin horas extra). */
  extraMinutes?: number | null;
  extraNote?: string | null;
  /** Hoy: true = validado (ha venido / ausencia confirmada); null/ausente = sin validar. */
  present?: boolean | null;
  /** Hoy: lo que pasó de verdad si no cuadra con el planning (`statusTypeId`); null = como el planning. */
  actualStatusTypeId?: string | null;
  segments: SegmentLite[];
}

export type EffectiveSource = "entry" | "fixed" | "default";

export interface EffectiveDay {
  employeeId: string;
  date: DateStr;
  status: StatusTypeLite;
  isWorking: boolean;
  isDayOff: boolean;
  /** Departamento efectivo ese día (entry.departmentId ?? habitual). */
  departmentId: string | null;
  /** Otros departamentos que también cubre esa noche (sin repetir el principal). */
  extraDepartmentIds: string[];
  reason: string | null;
  arrivedAt: string | null;
  leftAt: string | null;
  timeReason: string | null;
  extraMinutes: number | null;
  extraNote: string | null;
  /** Validado en Hoy (ha venido, o la ausencia está confirmada). */
  present: boolean;
  /** Estado del planning (Semana) si lo que pasó de verdad no cuadra con él (null = cuadra). */
  planned: StatusTypeLite | null;
  segments: SegmentLite[];
  hasEntry: boolean;
  source: EffectiveSource;
}

/** ¿Cuenta como día libre? (no trabaja y code OFF o PAID_OFF) */
export function isDayOffStatus(status: StatusTypeLite): boolean {
  return !status.isWorking && (status.code === "OFF" || status.code === "PAID_OFF");
}

function findByCode(statusTypes: StatusTypeLite[], code: string): StatusTypeLite {
  const s = statusTypes.find((x) => x.code === code);
  if (!s) throw new Error(`Falta el estado ${code}`);
  return s;
}

/**
 * Otros departamentos de esa noche: los que se eligieron en Hoy si se tocó el puesto (`departmentId` puesto o
 * extras elegidos); si no, los habituales del empleado (Ajustes → Empleados → «También cubre»).
 */
export function nightExtras(employee: EmployeeLite, entry: DayEntryLite | null | undefined): string[] {
  const chosen = entry?.extraDepartmentIds ?? [];
  if (entry && (entry.departmentId !== null || chosen.length > 0)) return chosen;
  return employee.defaultExtraDepartmentIds ?? [];
}

/** Mismos departamentos (sin importar el orden). */
export function sameIds(a: readonly string[], b: readonly string[]): boolean {
  const sa = new Set(a);
  return sa.size === new Set(b).size && b.every((x) => sa.has(x));
}

export function getEffectiveDay(
  employee: EmployeeLite,
  date: DateStr,
  entry: DayEntryLite | undefined | null,
  statusTypes: StatusTypeLite[],
): EffectiveDay {
  // `status` es lo que pasa de verdad (lo validado en Hoy) y `planned` el planning cuando no cuadra.
  let status: StatusTypeLite;
  let source: EffectiveSource;
  if (entry) {
    const found = statusTypes.find((s) => s.id === entry.statusTypeId);
    if (!found) throw new Error(`Estado desconocido: ${entry.statusTypeId}`);
    status = found;
    source = "entry";
  } else if (employee.fixedDaysOff.includes(weekdayIndex(date))) {
    status = findByCode(statusTypes, "OFF");
    source = "fixed";
  } else {
    status = findByCode(statusTypes, "WORK");
    source = "default";
  }
  const plan = status;
  const actual = entry?.actualStatusTypeId ? statusTypes.find((s) => s.id === entry.actualStatusTypeId) : undefined;
  if (actual) status = actual;
  const departmentId = entry?.departmentId ?? employee.defaultDepartmentId;
  return {
    employeeId: employee.id,
    date,
    status,
    isWorking: status.isWorking,
    isDayOff: isDayOffStatus(status),
    departmentId,
    extraDepartmentIds: [...new Set(nightExtras(employee, entry))].filter((id) => id !== departmentId),
    reason: entry?.reason ?? null,
    arrivedAt: entry?.arrivedAt ?? null,
    leftAt: entry?.leftAt ?? null,
    timeReason: entry?.timeReason ?? null,
    extraMinutes: entry?.extraMinutes ?? null,
    extraNote: entry?.extraNote ?? null,
    present: entry?.present === true,
    planned: status.id !== plan.id ? plan : null,
    segments: entry ? [...entry.segments].sort((a, b) => a.sortOrder - b.sortOrder) : [],
    hasEntry: !!entry,
    source,
  };
}

// ---- Utilidades ----------------------------------------------------------

const byOrderThenName = <T extends { sortOrder: number; name: string }>(a: T, b: T) =>
  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es");

function entryMap(entries: DayEntryLite[]): Map<string, DayEntryLite> {
  return new Map(entries.map((e) => [`${e.employeeId}|${e.date}`, e]));
}

// ---- Roster del día ------------------------------------------------------

export interface RosterMember {
  employee: EmployeeLite;
  day: EffectiveDay;
}

export interface DepartmentRoster {
  department: DepartmentLite;
  present: RosterMember[];
  /** Empleados cuyo departamento efectivo es éste pero hoy no trabajan. */
  absent: RosterMember[];
  /** Trabajan en otro departamento y además cubren éste esa noche. */
  covering: RosterMember[];
  /** Personas que cubren el departamento: `present` + `covering`. */
  staffed: number;
  targetStaff: number;
  /** Ningún trabajador presente (ni nadie que lo cubra). */
  isEmpty: boolean;
  /** Hay alguien pero menos que `targetStaff` (0 < cubierto < plazas). */
  isUnderStaffed: boolean;
}

export interface AbsentGroup {
  status: StatusTypeLite;
  members: RosterMember[];
}

export interface DayRoster {
  date: DateStr;
  departments: DepartmentRoster[];
  /** Trabajan pero sin departamento (o con uno inactivo/desconocido). */
  unassigned: RosterMember[];
  /** Todos los que no vienen, agrupados por estado (orden de estado). */
  absentByStatus: AbsentGroup[];
  presentCount: number;
  /** Nº de empleados activos por estado (todos los estados con >0). */
  countsByStatus: { status: StatusTypeLite; count: number }[];
  emptyDepartments: DepartmentLite[];
  underStaffedDepartments: DepartmentLite[];
}

export interface DayRosterInput {
  date: DateStr;
  employees: EmployeeLite[];
  entries: DayEntryLite[];
  departments: DepartmentLite[];
  statusTypes: StatusTypeLite[];
}

export function getDayRoster(input: DayRosterInput): DayRoster {
  const { date, statusTypes } = input;
  const entries = entryMap(input.entries.filter((e) => e.date === date));
  const departments = input.departments.filter((d) => d.active !== false).sort(byOrderThenName);
  const deptIds = new Set(departments.map((d) => d.id));
  const employees = input.employees.filter((e) => e.active).sort(byOrderThenName);

  const members: RosterMember[] = employees.map((employee) => ({
    employee,
    day: getEffectiveDay(employee, date, entries.get(`${employee.id}|${date}`), statusTypes),
  }));

  const deptRosters: DepartmentRoster[] = departments.map((department) => {
    const mine = members.filter((m) => m.day.departmentId === department.id);
    const present = mine.filter((m) => m.day.isWorking);
    const absent = mine.filter((m) => !m.day.isWorking);
    const covering = members.filter((m) => m.day.isWorking && m.day.extraDepartmentIds.includes(department.id));
    const staffed = present.length + covering.length;
    return {
      department,
      present,
      absent,
      covering,
      staffed,
      targetStaff: department.targetStaff,
      // Los secundarios (tareas de todos) nunca dan aviso de vacío o de faltar gente.
      isEmpty: staffed === 0 && !department.secondary,
      isUnderStaffed: !department.secondary && staffed > 0 && staffed < department.targetStaff,
    };
  });

  const unassigned = members.filter(
    (m) => m.day.isWorking && (m.day.departmentId === null || !deptIds.has(m.day.departmentId)),
  );

  const statuses = [...statusTypes]
    .filter((s) => s.active !== false || members.some((m) => m.day.status.id === s.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const absentByStatus: AbsentGroup[] = statuses
    .filter((s) => !s.isWorking)
    .map((status) => ({
      status,
      members: members.filter((m) => m.day.status.id === status.id),
    }))
    .filter((g) => g.members.length > 0);

  const countsByStatus = statuses
    .map((status) => ({
      status,
      count: members.filter((m) => m.day.status.id === status.id).length,
    }))
    .filter((c) => c.count > 0);

  return {
    date,
    departments: deptRosters,
    unassigned,
    absentByStatus,
    presentCount: members.filter((m) => m.day.isWorking).length,
    countsByStatus,
    emptyDepartments: deptRosters.filter((d) => d.isEmpty).map((d) => d.department),
    underStaffedDepartments: deptRosters.filter((d) => d.isUnderStaffed).map((d) => d.department),
  };
}

// ---- Cuadrícula semanal --------------------------------------------------

export interface WeekRow {
  employee: EmployeeLite;
  /** 7 celdas, lunes a domingo. */
  cells: EffectiveDay[];
  daysOff: number;
  /** daysOff distinto de daysOffPerWeek. */
  offWarning: boolean;
}

export interface WeekGroup {
  /** null = sin departamento habitual. */
  department: DepartmentLite | null;
  rows: WeekRow[];
}

export interface WeekGrid {
  weekStart: DateStr;
  days: DateStr[];
  groups: WeekGroup[];
  /** Todas las filas en el orden de los grupos. */
  rows: WeekRow[];
}

export interface WeekGridInput {
  /** Cualquier fecha de la semana. */
  date: DateStr;
  employees: EmployeeLite[];
  entries: DayEntryLite[];
  departments: DepartmentLite[];
  statusTypes: StatusTypeLite[];
  daysOffPerWeek: number;
}

export function getWeekGrid(input: WeekGridInput): WeekGrid {
  const days = weekDays(input.date);
  const entries = entryMap(input.entries);
  const departments = input.departments.filter((d) => d.active !== false).sort(byOrderThenName);
  const employees = input.employees.filter((e) => e.active).sort(byOrderThenName);

  const rows: WeekRow[] = employees.map((employee) => {
    const cells = days.map((d) =>
      getEffectiveDay(employee, d, entries.get(`${employee.id}|${d}`), input.statusTypes),
    );
    const daysOff = cells.filter((c) => c.isDayOff).length;
    return { employee, cells, daysOff, offWarning: daysOff !== input.daysOffPerWeek };
  });

  const groups: WeekGroup[] = departments.map((department) => ({
    department,
    rows: rows.filter((r) => r.employee.defaultDepartmentId === department.id),
  }));
  const known = new Set(departments.map((d) => d.id));
  const orphans = rows.filter(
    (r) => r.employee.defaultDepartmentId === null || !known.has(r.employee.defaultDepartmentId),
  );
  if (orphans.length > 0) groups.push({ department: null, rows: orphans });

  const nonEmpty = groups.filter((g) => g.rows.length > 0);
  return {
    weekStart: days[0]!,
    days,
    groups: nonEmpty,
    rows: nonEmpty.flatMap((g) => g.rows),
  };
}
