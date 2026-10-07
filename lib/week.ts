/**
 * Lógica pura de la pantalla Semana (sin Prisma): resumen semanal por persona,
 * plan de escritura de una celda y plan de "copiar semana anterior".
 * El "día efectivo" siempre sale de lib/schedule.ts.
 */
import { type DateStr, addDays, diffDays as diffDaysStr, weekDays } from "./dates";
import {
  type DayEntryLite,
  type DayRoster,
  type EmployeeLite,
  type StatusTypeLite,
  getEffectiveDay,
} from "./schedule";

const ABBR_BY_CODE: Record<string, string> = {
  WORK: "T",
  OFF: "F",
  PAID_OFF: "R",
  SICK: "B",
  VACATION: "V",
  ABSENT: "Fa",
};

/** Letra corta del estado (accesibilidad: no depender solo del color). */
export function statusAbbr(status: { code: string; label: string }): string {
  return ABBR_BY_CODE[status.code] ?? (status.label.trim().charAt(0).toUpperCase() || "?");
}

/** Nombres cortos: primer nombre; si se repite, añade la inicial del último apellido. */
export function shortNames(fullNames: string[]): string[] {
  const parts = fullNames.map((n) => n.trim().split(/\s+/).filter(Boolean));
  const count = new Map<string, number>();
  for (const p of parts) count.set(p[0] ?? "", (count.get(p[0] ?? "") ?? 0) + 1);
  return parts.map((p, i) => {
    const first = p[0] ?? fullNames[i]!;
    if ((count.get(first) ?? 0) > 1 && p.length > 1) return `${first} ${p[p.length - 1]!.charAt(0)}.`;
    return first;
  });
}

/** Nombre para vistas compactas: el alias si existe; si no, el nombre corto de `shortNames`. */
export function compactNames(people: { name: string; alias?: string | null }[]): string[] {
  const short = shortNames(people.map((p) => p.name));
  return people.map((p, i) => p.alias?.trim() || short[i]!);
}

/** ¿Tiene datos además de estado/departamento/motivo? (nota, horario, tramos) */
export function hasExtraData(e: DayEntryLite): boolean {
  return !!(e.arrivedAt || e.leftAt || e.timeReason || (e.extraMinutes ?? 0) > 0 || e.extraNote || e.present === true || !!e.actualStatusTypeId || e.segments.length > 0);
}

/** ¿El estado coincide con el que da el patrón (días fijos) ese día? */
export function matchesPattern(
  employee: EmployeeLite,
  date: DateStr,
  statusTypeId: string,
  statusTypes: StatusTypeLite[],
): boolean {
  return getEffectiveDay(employee, date, null, statusTypes).status.id === statusTypeId;
}

/** Entrada sin información propia: equivale a no tener entrada. */
function isRedundant(
  employee: EmployeeLite,
  date: DateStr,
  e: { statusTypeId: string; departmentId: string | null; reason: string | null },
  extra: boolean,
  statusTypes: StatusTypeLite[],
): boolean {
  return (
    !extra &&
    !e.reason &&
    (e.departmentId === null || e.departmentId === employee.defaultDepartmentId) &&
    matchesPattern(employee, date, e.statusTypeId, statusTypes)
  );
}

export type CellWrite =
  | { kind: "delete" }
  | { kind: "upsert"; statusTypeId: string; reason: string | null };

/** Qué hacer al guardar un estado en una celda. */
/** ¿Es una falta por resolver? «Falta» en el planning o validada en Hoy (no vino). */
export function isAbsence(planningCode: string | null | undefined, actualCode: string | null | undefined): boolean {
  return planningCode === "ABSENT" || actualCode === "ABSENT";
}

/** Estados que suelen durar varios días seguidos: al ponerlos en Semana se pregunta cuántos días. */
export const MULTI_DAY_CODES = ["VACATION", "SICK"] as const;
export const MAX_RANGE_DAYS = 60;

export function isMultiDayStatus(code: string): boolean {
  return (MULTI_DAY_CODES as readonly string[]).includes(code);
}

/** `days` días seguidos desde `from` (incluido), entre 1 y MAX_RANGE_DAYS. */
export function rangeDates(from: DateStr, days: number): DateStr[] {
  const n = Math.max(1, Math.min(MAX_RANGE_DAYS, Math.floor(days)));
  return Array.from({ length: n }, (_, i) => addDays(from, i));
}

export function planSetCell(input: {
  employee: EmployeeLite;
  date: DateStr;
  statusTypeId: string;
  reason: string | null;
  existing: DayEntryLite | null;
  statusTypes: StatusTypeLite[];
}): CellWrite {
  const { employee, date, statusTypeId, existing, statusTypes } = input;
  const reason = input.reason?.trim() ? input.reason.trim() : null;
  const candidate = {
    statusTypeId,
    reason,
    departmentId: existing?.departmentId ?? null,
  };
  if (isRedundant(employee, date, candidate, existing ? hasExtraData(existing) : false, statusTypes)) {
    return { kind: "delete" };
  }
  return { kind: "upsert", statusTypeId, reason };
}

export type EntryOp =
  | { kind: "delete"; employeeId: string; date: DateStr }
  | {
      kind: "upsert";
      employeeId: string;
      date: DateStr;
      statusTypeId: string;
      departmentId: string | null;
      reason: string | null;
    };

/**
 * Copia status/departamento/motivo de la semana previa a `weekStart`.
 * La semana destino queda igual que la anterior en esos campos; las notas,
 * horarios y tramos de la semana destino se conservan.
 */
export function planCopyWeek(input: {
  weekStart: DateStr;
  employees: EmployeeLite[];
  statusTypes: StatusTypeLite[];
  prevEntries: DayEntryLite[];
  curEntries: DayEntryLite[];
  /** Días entre la semana origen y la destino (7 = la anterior). */
  offset?: number;
  /** Celdas de la semana destino que no se tocan. */
  keep?: (current: DayEntryLite) => boolean;
}): EntryOp[] {
  const { employees, statusTypes } = input;
  const key = (e: { employeeId: string; date: DateStr }) => `${e.employeeId}|${e.date}`;
  const prev = new Map(input.prevEntries.map((e) => [key(e), e]));
  const cur = new Map(input.curEntries.map((e) => [key(e), e]));
  const ops: EntryOp[] = [];

  for (const employee of employees.filter((e) => e.active)) {
    for (const date of weekDays(input.weekStart)) {
      const p = prev.get(`${employee.id}|${addDays(date, -(input.offset ?? 7))}`);
      const c = cur.get(`${employee.id}|${date}`);
      if (c && input.keep?.(c)) continue;
      const extra = c ? hasExtraData(c) : false;

      let target: { statusTypeId: string; departmentId: string | null; reason: string | null };
      if (p) {
        target = { statusTypeId: p.statusTypeId, departmentId: p.departmentId, reason: p.reason };
      } else if (c) {
        // La semana previa seguía el patrón: volver al patrón.
        target = {
          statusTypeId: getEffectiveDay(employee, date, null, statusTypes).status.id,
          departmentId: null,
          reason: null,
        };
      } else {
        continue;
      }

      if (isRedundant(employee, date, target, extra, statusTypes)) {
        if (c) ops.push({ kind: "delete", employeeId: employee.id, date });
        continue;
      }
      if (
        c &&
        c.statusTypeId === target.statusTypeId &&
        c.departmentId === target.departmentId &&
        c.reason === target.reason
      ) {
        continue;
      }
      ops.push({ kind: "upsert", employeeId: employee.id, date, ...target });
    }
  }
  return ops;
}

/** Estados que forman el planning "de rotación" y se repiten semana a semana. */
const ROTATION_CODES = new Set(["WORK", "OFF"]);

/**
 * Semanas completas (lunes) que quedan del mes tras `weekStart`. Una semana es del mes que
 * contiene su jueves (la mayoría de sus días), como en la numeración ISO.
 */
export function remainingMonthWeeks(weekStart: DateStr): DateStr[] {
  const month = addDays(weekStart, 3).slice(0, 7);
  const out: DateStr[] = [];
  for (let s = addDays(weekStart, 7); addDays(s, 3).slice(0, 7) === month; s = addDays(s, 7)) out.push(s);
  return out;
}

/**
 * Repite el planning de la semana `sourceStart` en las semanas `targets`:
 *  - copia trabaja/fiesta y departamento; las ausencias puntuales del origen (vacaciones, baja…)
 *    no se repiten: esa celda vuelve al patrón del empleado;
 *  - en destino se respetan las ausencias ya puestas (vacaciones aprobadas, bajas…).
 */
export function planRepeatWeek(input: {
  sourceStart: DateStr;
  targets: DateStr[];
  employees: EmployeeLite[];
  statusTypes: StatusTypeLite[];
  sourceEntries: DayEntryLite[];
  targetEntries: DayEntryLite[];
}): EntryOp[] {
  const { employees, statusTypes } = input;
  const code = (id: string) => statusTypes.find((s) => s.id === id)?.code ?? "";
  const byId = new Map(employees.map((e) => [e.id, e]));
  const source = input.sourceEntries.flatMap((e) => {
    if (ROTATION_CODES.has(code(e.statusTypeId))) return [e];
    const emp = byId.get(e.employeeId);
    if (!emp) return [];
    const pattern = getEffectiveDay(emp, e.date, null, statusTypes).status.id;
    return [{ ...e, statusTypeId: pattern, reason: null }];
  });
  const keep = (c: DayEntryLite) => !ROTATION_CODES.has(code(c.statusTypeId));
  return input.targets.flatMap((target) => {
    const days = weekDays(target);
    const cur = input.targetEntries.filter((e) => e.date >= days[0]! && e.date <= days[6]!);
    return planCopyWeek({
      weekStart: target,
      employees,
      statusTypes,
      prevEntries: source,
      curEntries: cur,
      offset: diffDaysStr(input.sourceStart, target),
      keep,
    });
  });
}

/** Ruta de una semana conservando la vista elegida. */
export function weekHref(date: DateStr | null, view: "dias" | "personas"): string {
  const base = date ? `/semana/${date}` : "/semana";
  return view === "personas" ? `${base}?v=personas` : base;
}

export interface WeekSummaryToken {
  key: string;
  text: string;
  /** Pertenece a los días libres (para avisar si no cuadran con los esperados). */
  dayOff: boolean;
}

/** Horas en formato corto con coma decimal: 120 → "2", 90 → "1,5", 45 → "0,75". */
export function formatHoursShort(minutes: number): string {
  return String(Math.round((minutes / 60) * 100) / 100).replace(".", ",");
}

/**
 * Resumen de la fila de una persona: solo lo que hay, en el orden de los estados.
 * Ej.: 6 trabaja + 1 fiesta + 2 h extra → "6T 1F 2X".
 */
export function weekSummary(
  cells: { status: StatusTypeLite; extraMinutes: number | null }[],
  statuses: StatusTypeLite[],
): WeekSummaryToken[] {
  const counts = new Map<string, number>();
  let extra = 0;
  for (const c of cells) {
    counts.set(c.status.id, (counts.get(c.status.id) ?? 0) + 1);
    extra += c.extraMinutes ?? 0;
  }
  const tokens: WeekSummaryToken[] = [...statuses]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((s) => counts.has(s.id))
    .map((s) => ({
      key: s.id,
      text: `${counts.get(s.id)}${statusAbbr(s)}`,
      dayOff: !s.isWorking && (s.code === "OFF" || s.code === "PAID_OFF"),
    }));
  if (extra > 0) tokens.push({ key: "extra", text: `${formatHoursShort(extra)}X`, dayOff: false });
  return tokens;
}

// ---- Resumen de un día (Semana → Días) -------------------------------------

export interface DayIssue {
  name: string;
  present: number;
  target: number;
}

export interface DaySummary {
  /** ok = todos los departamentos cubiertos; warn = faltan plazas; bad = algún departamento sin nadie. */
  level: "ok" | "warn" | "bad";
  present: number;
  /** Plazas sin cubrir (suma de plazas − presentes en los departamentos cortos). */
  missing: number;
  issues: DayIssue[];
  /** Los que libran (Fiesta): lo normal, se muestra discreto. */
  off: string[];
  /** Resto de ausencias (vacaciones, baja, falta…), lo que hay que ver. */
  away: { id: string; label: string; color: string; names: string[] }[];
}

/** Resumen visual de una noche: quién viene, quién no y si algún departamento se queda corto. */
export function daySummary(r: DayRoster): DaySummary {
  const issues: DayIssue[] = r.departments
    .filter((d) => d.present.length + d.absent.length + d.covering.length > 0 && (d.isEmpty || d.isUnderStaffed))
    .map((d) => ({ name: d.department.name, present: d.staffed, target: d.targetStaff }));
  const missing = issues.reduce((n, i) => n + Math.max(0, i.target - i.present), 0);
  const level = issues.some((i) => i.present === 0) ? "bad" : issues.length > 0 ? "warn" : "ok";
  const offGroup = r.absentByStatus.find((g) => g.status.code === "OFF");
  return {
    level,
    present: r.presentCount,
    missing,
    issues,
    off: offGroup ? compactNames(offGroup.members.map((m) => m.employee)) : [],
    away: r.absentByStatus
      .filter((g) => g.status.code !== "OFF")
      .map((g) => ({
        id: g.status.id,
        label: g.status.label,
        color: g.status.color,
        names: compactNames(g.members.map((m) => m.employee)),
      })),
  };
}
