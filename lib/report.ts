/**
 * Lógica pura del Informe (día y semana) y su texto para compartir.
 * Parte de `getDayRoster` / `getWeekGrid` (lib/schedule.ts): NO reimplementa
 * la regla del "día efectivo". No accede a datos.
 *
 * Los minutos se miden desde el inicio del turno (cruzando medianoche):
 * con turno 21:30–06:30, "00:30" = 180 y "06:30" = 540.
 */
import { type DateStr, formatDayLong, formatWeekRange, isoWeekNumber, weekDays } from "./dates";
import { type ReportView, reportsToTextLines } from "./reports";
import type { DayRoster, RosterMember, StatusTypeLite, WeekGrid } from "./schedule";

export interface ShiftConfig {
  shiftStart: string;
  shiftEnd: string;
  breakStart: string;
  breakEnd: string;
}

export const DEFAULT_SHIFT: ShiftConfig = {
  shiftStart: "21:30",
  shiftEnd: "06:30",
  breakStart: "02:00",
  breakEnd: "03:00",
};

const DAY = 1440;

export function toMinutes(time: string): number {
  const [h, m] = time.split(":");
  return Number(h) * 60 + Number(m);
}

/** Minutos desde el inicio del turno (0..1439), cruzando medianoche. */
export function minutesFromShiftStart(time: string, shiftStart: string): number {
  return (((toMinutes(time) - toMinutes(shiftStart)) % DAY) + DAY) % DAY;
}

export function shiftLength(cfg: ShiftConfig): number {
  const len = minutesFromShiftStart(cfg.shiftEnd, cfg.shiftStart);
  return len === 0 ? DAY : len;
}

/** "45 min", "1 h", "1 h 15 min". */
export function formatDuration(min: number): string {
  const m = Math.abs(Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}

/**
 * Diferencia entre la hora de salida real y el fin de turno, en minutos.
 * Positivo = se queda más; negativo = sale antes. Cruza medianoche.
 */
export function leaveDelta(leftAt: string, cfg: ShiftConfig): number {
  const len = shiftLength(cfg);
  let delta = minutesFromShiftStart(leftAt, cfg.shiftStart) - len;
  if (delta > DAY / 2) delta -= DAY; // p. ej. 21:00 con turno 21:30–06:30: antes de empezar
  return delta;
}

/** Minutos de retraso al llegar (0 si no es tarde o la hora es incoherente). */
export function lateMinutes(arrivedAt: string, cfg: ShiftConfig): number {
  const rel = minutesFromShiftStart(arrivedAt, cfg.shiftStart);
  return rel > DAY / 2 ? 0 : rel;
}

// ---- Informe del día -----------------------------------------------------

export interface ReportSegment {
  label: string;
  start: string;
  end: string;
  note: string | null;
  /** Posición en la barra, en minutos desde el inicio del turno. */
  relStart: number;
  relEnd: number;
  /** Índice estable para colorear (mismo nombre = mismo color). */
  colorIndex: number;
}

export interface ReportMember {
  employeeId: string;
  name: string;
  departmentName: string | null;
  /** Departamento habitual, si hoy lo han movido a otro. */
  movedFrom: string | null;
  note: string | null;
  arrivedAt: string | null;
  leftAt: string | null;
  timeReason: string | null;
  segments: ReportSegment[];
}

export interface LateArrival {
  name: string;
  arrivedAt: string;
  minutes: number;
  reason: string | null;
}

export interface LeaveDeviation {
  name: string;
  leftAt: string;
  kind: "stayed" | "early";
  minutes: number;
  reason: string | null;
}

export interface AbsenceGroup {
  statusId: string;
  label: string;
  color: string;
  members: { name: string; reason: string | null }[];
}

export interface ReportDepartment {
  id: string | null;
  name: string;
  color: string;
  presentCount: number;
  targetStaff: number;
  members: ReportMember[];
}

export interface DayReport {
  date: DateStr;
  title: string;
  note: string | null;
  shift: {
    start: string;
    end: string;
    breakStart: string;
    breakEnd: string;
    length: number;
    breakFrom: number;
    breakTo: number;
  };
  presentCount: number;
  lateArrivals: LateArrival[];
  leaveDeviations: LeaveDeviation[];
  absences: AbsenceGroup[];
  absentCount: number;
  emptyDepartments: string[];
  departments: ReportDepartment[];
  /** Trabajan pero sin departamento. */
  unassigned: ReportMember[];
  hasIncidents: boolean;
  /** Avisos con foto de la noche. */
  reports: ReportView[];
  isEmpty: boolean;
}

export interface BuildDayReportInput {
  roster: DayRoster;
  dayNote: string | null;
  shift: ShiftConfig;
  sections: { id: string; name: string }[];
  /** Todos los departamentos (para el nombre del departamento habitual). */
  departments: { id: string; name: string }[];
  /** Avisos con foto de la noche (opcional). */
  reports?: ReportView[];
}

export function buildDayReport(input: BuildDayReportInput): DayReport {
  const { roster, shift } = input;
  const len = shiftLength(shift);
  const sectionName = new Map(input.sections.map((s) => [s.id, s.name]));
  const deptName = new Map(input.departments.map((d) => [d.id, d.name]));
  const colorKeys: string[] = [];
  const colorOf = (key: string) => {
    let i = colorKeys.indexOf(key);
    if (i < 0) i = colorKeys.push(key) - 1;
    return i;
  };

  const toMember = (m: RosterMember): ReportMember => {
    const d = m.day;
    const home = m.employee.defaultDepartmentId;
    const moved = d.departmentId !== home;
    const segments: ReportSegment[] = d.segments.map((s) => {
      const label = (s.sectionId ? sectionName.get(s.sectionId) : null) ?? s.label ?? "Tarea";
      const relStart = minutesFromShiftStart(s.start, shift.shiftStart);
      let relEnd = minutesFromShiftStart(s.end, shift.shiftStart);
      if (relEnd <= relStart) relEnd = relEnd === 0 && relStart > 0 ? len : relEnd + DAY;
      return {
        label,
        start: s.start,
        end: s.end,
        note: s.note,
        relStart: Math.min(relStart, len),
        relEnd: Math.min(relEnd, len),
        colorIndex: colorOf(label),
      };
    });
    return {
      employeeId: m.employee.id,
      name: m.employee.name,
      departmentName: d.departmentId ? (deptName.get(d.departmentId) ?? null) : null,
      movedFrom: moved && home ? (deptName.get(home) ?? null) : null,
      note: d.note,
      arrivedAt: d.arrivedAt,
      leftAt: d.leftAt,
      timeReason: d.timeReason,
      segments,
    };
  };

  const departments: ReportDepartment[] = roster.departments
    .filter((r) => r.present.length > 0)
    .map((r) => ({
      id: r.department.id,
      name: r.department.name,
      color: r.department.color,
      presentCount: r.present.length,
      targetStaff: r.targetStaff,
      members: r.present.map(toMember),
    }));
  const unassigned = roster.unassigned.map(toMember);

  const everyone = [...departments.flatMap((d) => d.members), ...unassigned];
  const lateArrivals: LateArrival[] = [];
  const leaveDeviations: LeaveDeviation[] = [];
  for (const m of everyone) {
    if (m.arrivedAt) {
      const minutes = lateMinutes(m.arrivedAt, shift);
      if (minutes > 0) {
        lateArrivals.push({ name: m.name, arrivedAt: m.arrivedAt, minutes, reason: m.timeReason });
      }
    }
    if (m.leftAt) {
      const delta = leaveDelta(m.leftAt, shift);
      if (delta !== 0) {
        leaveDeviations.push({
          name: m.name,
          leftAt: m.leftAt,
          kind: delta > 0 ? "stayed" : "early",
          minutes: Math.abs(delta),
          reason: m.timeReason,
        });
      }
    }
  }
  lateArrivals.sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));

  const absences: AbsenceGroup[] = roster.absentByStatus.map((g) => ({
    statusId: g.status.id,
    label: g.status.label,
    color: g.status.color,
    members: g.members.map((m) => ({ name: m.employee.name, reason: m.day.reason })),
  }));
  const absentCount = absences.reduce((n, g) => n + g.members.length, 0);
  const emptyDepartments = roster.emptyDepartments.map((d) => d.name);

  const hasIncidents =
    lateArrivals.length > 0 || leaveDeviations.length > 0 || absentCount > 0 || emptyDepartments.length > 0;

  return {
    date: roster.date,
    title: formatDayLong(roster.date),
    note: input.dayNote?.trim() ? input.dayNote.trim() : null,
    shift: {
      start: shift.shiftStart,
      end: shift.shiftEnd,
      breakStart: shift.breakStart,
      breakEnd: shift.breakEnd,
      length: len,
      breakFrom: Math.min(minutesFromShiftStart(shift.breakStart, shift.shiftStart), len),
      breakTo: Math.min(
        minutesFromShiftStart(shift.breakStart, shift.shiftStart) +
          ((minutesFromShiftStart(shift.breakEnd, shift.breakStart) || 0)),
        len,
      ),
    },
    presentCount: roster.presentCount,
    lateArrivals,
    leaveDeviations,
    absences,
    absentCount,
    emptyDepartments,
    departments,
    unassigned,
    hasIncidents,
    reports: input.reports ?? [],
    isEmpty: roster.presentCount === 0 && absentCount === 0 && (input.reports ?? []).length === 0,
  };
}

// ---- Resumen semanal -----------------------------------------------------

export interface WeekSummaryEmployee {
  employeeId: string;
  name: string;
  /** statusId -> nº de días (solo estados que no trabajan). */
  counts: Record<string, number>;
  lateArrivals: number;
}

export interface WeekSummary {
  weekStart: DateStr;
  title: string;
  range: string;
  /** Estados no trabajando con algún día en la semana, con su total. */
  byType: { status: StatusTypeLite; count: number }[];
  byEmployee: WeekSummaryEmployee[];
  totalLate: number;
  emptyDays: { date: DateStr; label: string; departments: string[] }[];
  isEmpty: boolean;
}

export interface BuildWeekSummaryInput {
  date: DateStr;
  grid: WeekGrid;
  statusTypes: StatusTypeLite[];
  /** Un DayRoster por cada día de la semana (mismas fechas que grid.days). */
  rosters: DayRoster[];
  shift: ShiftConfig;
}

export function buildWeekSummary(input: BuildWeekSummaryInput): WeekSummary {
  const { grid, shift } = input;
  const days = weekDays(input.date);
  const statuses = [...input.statusTypes].sort((a, b) => a.sortOrder - b.sortOrder);

  const totals = new Map<string, number>();
  const byEmployee: WeekSummaryEmployee[] = [];
  for (const row of grid.rows) {
    const counts: Record<string, number> = {};
    let late = 0;
    for (const cell of row.cells) {
      if (!cell.isWorking) {
        counts[cell.status.id] = (counts[cell.status.id] ?? 0) + 1;
        totals.set(cell.status.id, (totals.get(cell.status.id) ?? 0) + 1);
      } else if (cell.arrivedAt && lateMinutes(cell.arrivedAt, shift) > 0) {
        late += 1;
      }
    }
    if (late > 0 || Object.keys(counts).length > 0) {
      byEmployee.push({ employeeId: row.employee.id, name: row.employee.name, counts, lateArrivals: late });
    }
  }

  const byType = statuses
    .filter((s) => !s.isWorking && (totals.get(s.id) ?? 0) > 0)
    .map((status) => ({ status, count: totals.get(status.id)! }));

  const emptyDays = input.rosters
    .filter((r) => r.emptyDepartments.length > 0)
    .map((r) => ({
      date: r.date,
      label: formatDayLong(r.date),
      departments: r.emptyDepartments.map((d) => d.name),
    }));

  const totalLate = byEmployee.reduce((n, e) => n + e.lateArrivals, 0);
  return {
    weekStart: days[0]!,
    title: `Semana ${isoWeekNumber(days[0]!)}`,
    range: formatWeekRange(input.date),
    byType,
    byEmployee,
    totalLate,
    emptyDays,
    isEmpty: byType.length === 0 && totalLate === 0 && emptyDays.length === 0,
  };
}

// ---- Texto para compartir (WhatsApp) -------------------------------------

function segText(s: ReportSegment): string {
  return `${s.start}–${s.end} ${s.label}`;
}

/** Texto plano con *negritas* estilo WhatsApp. */
export function reportToText(report: DayReport): string {
  const L: string[] = [];
  L.push(`*Informe de noche · ${report.title}*`);
  L.push(`Turno ${report.shift.start}–${report.shift.end} · ${report.presentCount} trabajan`);

  if (report.note) {
    L.push("", "*Nota del día*", report.note);
  }

  if (report.hasIncidents) {
    L.push("", "*Incidencias*");
    for (const name of report.emptyDepartments) L.push(`• Sin personal en ${name}`);
    for (const l of report.lateArrivals) {
      L.push(`• ${l.name}: llega tarde a las ${l.arrivedAt} (+${formatDuration(l.minutes)})${l.reason ? ` — ${l.reason}` : ""}`);
    }
    for (const d of report.leaveDeviations) {
      const what = d.kind === "stayed" ? `se queda ${formatDuration(d.minutes)} más` : `se va ${formatDuration(d.minutes)} antes`;
      L.push(`• ${d.name}: ${what} (sale a las ${d.leftAt})${d.reason ? ` — ${d.reason}` : ""}`);
    }
    for (const g of report.absences) {
      L.push(`• *${g.label}*: ${g.members.map((m) => (m.reason ? `${m.name} (${m.reason})` : m.name)).join(", ")}`);
    }
  } else if (!report.isEmpty) {
    L.push("", "Sin incidencias.");
  }

  L.push(...reportsToTextLines(report.reports));

  const block = (m: ReportMember, deptName: string) => {
    const moved = m.movedFrom ? ` (${m.movedFrom} → ${m.departmentName ?? "—"})` : "";
    if (m.segments.length > 0) {
      L.push(`• ${m.name}${moved}: ${m.segments.map(segText).join(" → ")}`);
    } else {
      const where = m.departmentName ?? deptName;
      L.push(`• ${m.name}${moved}: turno completo${where ? ` en ${where}` : ""}`);
    }
    if (m.note) L.push(`   ${m.note}`);
  };

  for (const d of report.departments) {
    L.push("", `*${d.name}* (${d.presentCount}${d.targetStaff > 0 ? `/${d.targetStaff}` : ""})`);
    for (const m of d.members) block(m, d.name);
  }
  if (report.unassigned.length > 0) {
    L.push("", "*Sin departamento*");
    for (const m of report.unassigned) block(m, "");
  }

  return L.join("\n");
}

