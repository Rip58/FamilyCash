/**
 * Lógica pura de las peticiones de la ficha del empleado (sin Prisma):
 * qué días cambia cada tipo de petición, conflictos, impacto en plantilla
 * y cómo deshacer. El "día efectivo" sale siempre de lib/schedule.ts.
 */
import { z } from "zod";
import { type DateStr, WEEKDAY_SHORT, addDays, diffDays, formatDayMonth, isDateStr, weekdayIndex } from "./dates";
import {
  type DayEntryLite,
  type DepartmentLite,
  type EmployeeLite,
  type StatusTypeLite,
  getDayRoster,
  getEffectiveDay,
} from "./schedule";
import { matchesPattern } from "./week";

export const LEAVE_TYPES = ["SWAP_OFF", "VACATION", "PAID_OFF", "OTHER"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];
export const LEAVE_STATUSES = ["PENDING", "APPROVED", "DENIED"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

/** Rango máximo (días) de vacaciones / permiso. */
export const MAX_LEAVE_DAYS = 60;

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  SWAP_OFF: "Cambio de fiesta",
  VACATION: "Vacaciones",
  PAID_OFF: "Fiesta retribuida / Permiso",
  OTHER: "Otro",
};

export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  DENIED: "Denegada",
};

export interface LeaveRequestLite {
  type: LeaveType;
  /** SWAP_OFF: día que deja de librar (A). Resto: inicio. */
  dateFrom: DateStr;
  /** SWAP_OFF: día que pasa a librar (B). Resto: fin. */
  dateTo: DateStr;
}

/** Estado previo de una entrada de día, para poder restaurarla. */
export interface EntrySnapshot {
  statusTypeId: string;
  departmentId: string | null;
  reason: string | null;
}

export interface LeaveChange {
  date: DateStr;
  /** Estado efectivo antes del cambio. */
  fromStatusId: string;
  toStatusId: string;
  /** DayEntry que existía (null = seguía el patrón). */
  prevEntry: EntrySnapshot | null;
}

export interface LeaveConflict {
  date: DateStr;
  /** Estado que tenía el día (distinto del patrón). */
  statusId: string;
}

export interface LeavePlan {
  changes: LeaveChange[];
  conflicts: LeaveConflict[];
  error: string | null;
}

// ---- Validación de fechas -------------------------------------------------

/** Nº de días del rango (inclusive), o 0 si no es un rango válido. */
export function rangeLength(from: DateStr, to: DateStr): number {
  if (!isDateStr(from) || !isDateStr(to)) return 0;
  const n = diffDays(from, to) + 1;
  return n >= 1 ? n : 0;
}

/** Mensaje de error si las fechas de la petición no son válidas; null si lo son. */
export function validateLeaveDates(type: LeaveType, from: DateStr, to: DateStr): string | null {
  if (!isDateStr(from) || !isDateStr(to)) return "Fecha no válida.";
  if (type === "SWAP_OFF") {
    if (from === to) return "Elige dos días distintos.";
    return null;
  }
  const n = rangeLength(from, to);
  if (n === 0) return "La fecha final no puede ser anterior a la inicial.";
  if (n > MAX_LEAVE_DAYS) return `El rango no puede superar ${MAX_LEAVE_DAYS} días.`;
  return null;
}

/** Fechas del calendario a las que afecta la petición (para el puntito en Semana). */
export function requestDates(r: LeaveRequestLite): DateStr[] {
  if (r.type === "SWAP_OFF") return [r.dateFrom, r.dateTo];
  if (validateLeaveDates(r.type, r.dateFrom, r.dateTo)) return [r.dateFrom];
  const n = rangeLength(r.dateFrom, r.dateTo);
  return Array.from({ length: n }, (_, i) => addDays(r.dateFrom, i));
}

// ---- Resumen legible ------------------------------------------------------

/** "12–18 oct", "28 sep – 3 oct" o "12 oct". */
export function formatRange(from: DateStr, to: DateStr): string {
  if (from === to) return formatDayMonth(from);
  const [, m1] = from.split("-");
  const [, m2] = to.split("-");
  if (m1 === m2 && from.slice(0, 4) === to.slice(0, 4)) {
    return `${Number(from.slice(8))}–${formatDayMonth(to)}`;
  }
  return `${formatDayMonth(from)} – ${formatDayMonth(to)}`;
}

export function daysLabel(n: number): string {
  return n === 1 ? "1 día" : `${n} días`;
}

/** "Sáb 4 oct" */
export function dayWithMonth(d: DateStr): string {
  return `${WEEKDAY_SHORT[weekdayIndex(d)]} ${formatDayMonth(d)}`;
}

/** "Vacaciones 12–18 oct · 7 días" / "Cambio de fiesta: libra Sáb 4 oct en vez de Lun 29 sep". */
export function summarizeRequest(r: LeaveRequestLite): string {
  if (r.type === "SWAP_OFF") {
    return `Cambio de fiesta: libra ${dayWithMonth(r.dateTo)} en vez de ${dayWithMonth(r.dateFrom)}`;
  }
  const n = rangeLength(r.dateFrom, r.dateTo);
  const label = r.type === "PAID_OFF" ? "Permiso" : LEAVE_TYPE_LABEL[r.type];
  return `${label} ${formatRange(r.dateFrom, r.dateTo)}${n > 1 ? ` · ${daysLabel(n)}` : ""}`;
}

// ---- Plan de aprobación ---------------------------------------------------

function byCode(statusTypes: StatusTypeLite[], code: string): StatusTypeLite | undefined {
  return statusTypes.find((s) => s.code === code);
}

/**
 * Cambios de calendario que produce aprobar la petición.
 * - VACATION -> VACATION cada día del rango; PAID_OFF -> PAID_OFF.
 * - SWAP_OFF -> A: WORK, B: OFF.
 * - OTHER -> ninguno.
 * Los días que ya están en el estado final no generan cambio. Un conflicto es
 * un día con un estado propio (DayEntry) distinto del patrón que se sobrescribe.
 */
export function planLeaveApproval(
  request: LeaveRequestLite,
  employee: EmployeeLite,
  entries: DayEntryLite[],
  statusTypes: StatusTypeLite[],
): LeavePlan {
  const empty = (error: string | null): LeavePlan => ({ changes: [], conflicts: [], error });
  if (request.type === "OTHER") return empty(null);
  const dateError = validateLeaveDates(request.type, request.dateFrom, request.dateTo);
  if (dateError) return empty(dateError);

  const targets: { date: DateStr; code: string }[] =
    request.type === "SWAP_OFF"
      ? [
          { date: request.dateFrom, code: "WORK" },
          { date: request.dateTo, code: "OFF" },
        ]
      : requestDates(request).map((date) => ({ date, code: request.type }));

  const mine = new Map(entries.filter((e) => e.employeeId === employee.id).map((e) => [e.date, e]));
  const changes: LeaveChange[] = [];
  const conflicts: LeaveConflict[] = [];
  for (const t of targets) {
    const to = byCode(statusTypes, t.code);
    if (!to) return empty(`Falta el estado ${t.code} en Ajustes → Estados.`);
    const entry = mine.get(t.date) ?? null;
    const current = getEffectiveDay(employee, t.date, entry, statusTypes);
    if (current.status.id === to.id) continue;
    if (entry && !matchesPattern(employee, t.date, entry.statusTypeId, statusTypes)) {
      conflicts.push({ date: t.date, statusId: entry.statusTypeId });
    }
    changes.push({
      date: t.date,
      fromStatusId: current.status.id,
      toStatusId: to.id,
      prevEntry: entry
        ? { statusTypeId: entry.statusTypeId, departmentId: entry.departmentId, reason: entry.reason }
        : null,
    });
  }
  return { changes, conflicts, error: null };
}

// ---- Revertir -------------------------------------------------------------

export interface RevertWrite {
  date: DateStr;
  statusTypeId: string;
  reason: string | null;
}

/**
 * Escrituras que restauran el estado previo de cada día aplicado.
 * `currentStatusByDate` (opcional): si un día ya no está en el estado que puso la
 * aprobación (alguien lo cambió a mano después), se respeta y no se toca.
 */
export function planLeaveRevert(
  applied: LeaveChange[],
  currentStatusByDate?: ReadonlyMap<DateStr, string>,
): RevertWrite[] {
  const out: RevertWrite[] = [];
  for (const c of applied) {
    const cur = currentStatusByDate?.get(c.date);
    if (cur !== undefined && cur !== c.toStatusId) continue;
    out.push({ date: c.date, statusTypeId: c.fromStatusId, reason: c.prevEntry?.reason ?? null });
  }
  return out;
}

/** appliedChanges guardado como JSON: se valida al leerlo. */
export const appliedChangesSchema = z.array(
  z.object({
    date: z.string().refine(isDateStr),
    fromStatusId: z.string(),
    toStatusId: z.string(),
    prevEntry: z
      .object({
        statusTypeId: z.string(),
        departmentId: z.string().nullable(),
        reason: z.string().nullable(),
      })
      .nullable(),
  }),
);

export function parseAppliedChanges(json: unknown): LeaveChange[] {
  const r = appliedChangesSchema.safeParse(json);
  return r.success ? r.data : [];
}

// ---- Impacto en plantilla -------------------------------------------------

export interface CoverageIssue {
  date: DateStr;
  departmentId: string;
  departmentName: string;
  before: number;
  after: number;
  target: number;
  kind: "empty" | "under";
}

/**
 * Departamentos que quedan vacíos o bajo plazas en los días cambiados por la petición
 * (solo se avisa si el cambio empeora la situación). `entries` = entradas de TODOS
 * los empleados en esos días.
 */
export function planLeaveImpact(input: {
  changes: LeaveChange[];
  employee: EmployeeLite;
  employees: EmployeeLite[];
  entries: DayEntryLite[];
  departments: DepartmentLite[];
  statusTypes: StatusTypeLite[];
}): CoverageIssue[] {
  const { changes, employee, employees, entries, departments, statusTypes } = input;
  const issues: CoverageIssue[] = [];
  for (const c of changes) {
    const existing = entries.find((e) => e.employeeId === employee.id && e.date === c.date) ?? null;
    const before = getDayRoster({ date: c.date, employees, entries, departments, statusTypes });
    const changed: DayEntryLite = existing
      ? { ...existing, statusTypeId: c.toStatusId }
      : {
          employeeId: employee.id,
          date: c.date,
          statusTypeId: c.toStatusId,
          departmentId: null,
          reason: null,
          note: null,
          arrivedAt: null,
          leftAt: null,
          timeReason: null,
          segments: [],
        };
    const afterEntries = [...entries.filter((e) => !(e.employeeId === employee.id && e.date === c.date)), changed];
    const after = getDayRoster({ date: c.date, employees, entries: afterEntries, departments, statusTypes });
    const deptId = getEffectiveDay(employee, c.date, existing, statusTypes).departmentId;
    if (!deptId) continue;
    const b = before.departments.find((d) => d.department.id === deptId);
    const a = after.departments.find((d) => d.department.id === deptId);
    if (!a || !b) continue;
    const bp = b.present.length;
    const ap = a.present.length;
    if (ap >= bp) continue;
    if (a.isEmpty && !b.isEmpty) {
      issues.push({ date: c.date, departmentId: deptId, departmentName: a.department.name, before: bp, after: ap, target: a.targetStaff, kind: "empty" });
    } else if (a.isUnderStaffed && !b.isEmpty) {
      issues.push({ date: c.date, departmentId: deptId, departmentName: a.department.name, before: bp, after: ap, target: a.targetStaff, kind: "under" });
    }
  }
  return issues;
}
