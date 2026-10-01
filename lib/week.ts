/**
 * Lógica pura de la pantalla Semana (sin Prisma): resumen semanal por persona,
 * plan de escritura de una celda y plan de "copiar semana anterior".
 * El "día efectivo" siempre sale de lib/schedule.ts.
 */
import { type DateStr, addDays, weekDays } from "./dates";
import {
  type DayEntryLite,
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
  return !!(e.note || e.arrivedAt || e.leftAt || e.timeReason || (e.extraMinutes ?? 0) > 0 || e.extraNote || e.present === true || e.segments.length > 0);
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
}): EntryOp[] {
  const { employees, statusTypes } = input;
  const key = (e: { employeeId: string; date: DateStr }) => `${e.employeeId}|${e.date}`;
  const prev = new Map(input.prevEntries.map((e) => [key(e), e]));
  const cur = new Map(input.curEntries.map((e) => [key(e), e]));
  const ops: EntryOp[] = [];

  for (const employee of employees.filter((e) => e.active)) {
    for (const date of weekDays(input.weekStart)) {
      const p = prev.get(`${employee.id}|${addDays(date, -7)}`);
      const c = cur.get(`${employee.id}|${date}`);
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
