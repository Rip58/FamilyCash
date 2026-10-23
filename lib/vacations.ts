/**
 * Vacaciones (lógica pura, sin BD ni zod): campaña anual, PIN fijo de cada empleado y máximo a la vez.
 * Se usa en el servidor, en Ajustes y en los tests.
 */
import { type DateStr, addDays, diffDays, formatDayMonth, isoWeekNumber, weekStart, weekdayIndex } from "./dates";

/** La página de los empleados (/vacaciones) llega en la fase 2: hasta entonces no se ofrece mandar el enlace. */
export const VACATION_PAGE_READY = true;

/** Año de la campaña en curso. */
export const VACATION_YEAR = 2027;
export const VACATION_PIN_RE = /^\d{4}$/;

export interface VacationCampaignView {
  year: number;
  workDays: number;
  deadline: DateStr;
  open: boolean;
  defaultMax: number;
  /** Máximo a la vez por departamento (los que no están usan `defaultMax`). */
  departmentMax: Record<string, number>;
}

export interface VacationWeekView {
  /** Lunes de la semana. */
  weekStart: DateStr;
  blocked: boolean;
  reason: string | null;
  /** Máximo a la vez solo esta semana (temporada alta o baja). */
  maxOverride: number | null;
}

/** PIN fáciles de adivinar: no se reparten. */
export function isTrivialPin(pin: string): boolean {
  if (!VACATION_PIN_RE.test(pin)) return true;
  if (/^(\d)\1{3}$/.test(pin)) return true; // 0000, 1111…
  const d = [...pin].map(Number);
  const up = d.every((x, i) => i === 0 || x === d[i - 1]! + 1);
  const down = d.every((x, i) => i === 0 || x === d[i - 1]! - 1);
  return up || down; // 1234, 4321…
}

/** Un PIN de 4 números que no tenga nadie (ni fácil). `random` devuelve [0, 1). */
export function pickPin(taken: ReadonlySet<string>, random: () => number = Math.random): string {
  for (let i = 0; i < 1000; i++) {
    const pin = String(Math.floor(random() * 10_000)).padStart(4, "0");
    if (!taken.has(pin) && !isTrivialPin(pin)) return pin;
  }
  for (let n = 0; n < 10_000; n++) {
    const pin = String(n).padStart(4, "0");
    if (!taken.has(pin) && !isTrivialPin(pin)) return pin;
  }
  throw new Error("No quedan PIN libres");
}

/** Máximo de personas de un departamento de vacaciones a la vez en la semana de `date`. */
export function maxAtOnce(
  campaign: Pick<VacationCampaignView, "defaultMax" | "departmentMax">,
  departmentId: string | null,
  week?: Pick<VacationWeekView, "maxOverride"> | null,
): number {
  if (week?.maxOverride != null) return week.maxOverride;
  if (departmentId && campaign.departmentMax[departmentId] != null) return campaign.departmentMax[departmentId]!;
  return campaign.defaultMax;
}

/** «S30 · 26 jul – 1 ago». */
export function weekLabel(monday: DateStr): string {
  return `S${isoWeekNumber(monday)} · ${formatDayMonth(monday)} – ${formatDayMonth(addDays(monday, 6))}`;
}

/** El lunes de la semana de cualquier día. */
export const mondayOf = (date: DateStr): DateStr => weekStart(date);

/** Texto para mandar por WhatsApp con el enlace y el PIN. */
export function vacationInvite(name: string, url: string, pin: string, campaign: Pick<VacationCampaignView, "year" | "deadline">): string {
  const first = name.split(/\s+/)[0] ?? name;
  const [y, m, d] = campaign.deadline.split("-");
  return `Hola ${first}: elige tus vacaciones de ${campaign.year} aquí ${url} con tu PIN ${pin}. Tienes hasta el ${Number(d)}/${Number(m)}/${y}.`;
}

/** departmentMax de la BD (JSON) → mapa limpio de números enteros ≥ 0. */
export function parseDepartmentMax(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
      if (typeof n === "number" && Number.isInteger(n) && n >= 0) out[k] = n;
    }
  }
  return out;
}

// ---- Días de un periodo ------------------------------------------------------------------------------------------

/** Un periodo que elige el empleado: del primer al último día que quiere librar (sus 2 de fiesta se añaden solos). */
export interface VacationRange {
  start: DateStr;
  end: DateStr;
}

export type VacationDayKind = "work" | "fiesta";

export interface VacationSpan {
  /** Todos los días del periodo: los elegidos y, al final, los de fiesta que se añaden. */
  days: { date: DateStr; kind: VacationDayKind }[];
  /** Días laborables que descuenta (L–V dentro de lo elegido). */
  counted: number;
  /** Último día del periodo con la fiesta añadida. */
  last: DateStr;
}

/**
 * Regla de la plantilla: cada semana tiene 2 días de fiesta que no descuentan.
 * - Dentro de lo elegido, sábado y domingo son su fiesta; de lunes a viernes, descuentan.
 * - En la última semana del periodo, si no llega a tener sus 2 de fiesta, se añaden justo después del último día:
 *   de miércoles a viernes → + sábado y domingo; de lunes a miércoles → + jueves y viernes.
 */
export function vacationSpan(r: VacationRange): VacationSpan {
  const days: VacationSpan["days"] = [];
  for (let d = r.start; d <= r.end; d = addDays(d, 1)) days.push({ date: d, kind: weekdayIndex(d) >= 5 ? "fiesta" : "work" });
  const lastWeek = weekStart(r.end);
  const fiestaInLastWeek = days.filter((x) => x.kind === "fiesta" && weekStart(x.date) === lastWeek).length;
  let last = r.end;
  for (let i = fiestaInLastWeek; i < 2; i++) {
    last = addDays(last, 1);
    days.push({ date: last, kind: "fiesta" });
  }
  return { days, counted: days.filter((x) => x.kind === "work").length, last };
}

/** «7 – 11 jul» con la fiesta incluida. */
export function rangeLabel(r: VacationRange): string {
  const s = vacationSpan(r);
  return `${formatDayMonth(r.start)} – ${formatDayMonth(s.last)}`;
}

/** Por qué no vale un conjunto de periodos (null = vale). */
export function checkVacations(
  ranges: VacationRange[],
  rules: { year: number; workDays: number; blocked: ReadonlySet<DateStr> },
): string | null {
  const spans = ranges.map((r) => ({ r, s: vacationSpan(r) }));
  for (const { r, s } of spans) {
    if (r.start > r.end) return "El último día no puede ser antes que el primero.";
    if (!r.start.startsWith(`${rules.year}-`) || !r.end.startsWith(`${rules.year}-`)) return `Solo se pueden elegir días de ${rules.year}.`;
    if (diffDays(r.start, r.end) > 62) return "Un periodo no puede pasar de 2 meses.";
    if (s.counted === 0) return "Elige al menos un día de lunes a viernes.";
    const blockedDay = s.days.find((d) => d.date <= r.end && rules.blocked.has(weekStart(d.date)));
    if (blockedDay) return `La semana del ${formatDayMonth(weekStart(blockedDay.date))} no se puede coger.`;
  }
  const sorted = [...spans].sort((a, b) => (a.r.start < b.r.start ? -1 : 1));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.r.start <= sorted[i - 1]!.s.last) return "Dos periodos se pisan (cuenta también la fiesta que se añade al final).";
  }
  const used = spans.reduce((n, x) => n + x.s.counted, 0);
  if (used > rules.workDays) return `Te pasas: ${used} de ${rules.workDays} días laborables.`;
  return null;
}

/** Días laborables que gastan unos periodos. */
export const countedDays = (ranges: VacationRange[]): number => ranges.reduce((n, r) => n + vacationSpan(r).counted, 0);

export const VACATION_STATUS_LABEL: Record<string, string> = {
  SENT: "Enviado",
  REVIEW: "A revisar",
  OK: "Correcto",
  APPLIED: "En el planning",
};

// ---- PIN de la página de vacaciones (bloqueo contra pruebas al azar) ---------------------------------------------

export const VACATION_LOCK_EVERY = 5;
export const VACATION_LOCK_MINUTES = 15;

/** Tras un PIN mal puesto: cada 5 fallos seguidos, 15 minutos sin poder probar (para todos). */
export function vacationLockAfter(fails: number, now: Date): Date | null {
  return fails > 0 && fails % VACATION_LOCK_EVERY === 0 ? new Date(now.getTime() + VACATION_LOCK_MINUTES * 60_000) : null;
}

/** Firma: PNG en data URL, ni vacía ni enorme. */
export const MAX_SIGNATURE_LENGTH = 400_000;
export function isSignature(v: string): boolean {
  return v.startsWith("data:image/png;base64,") && v.length > 200 && v.length <= MAX_SIGNATURE_LENGTH;
}

// ---- Vista general del encargado (como Semana → Personas) ---------------------------------------------------------

export interface VacGridEmployee {
  id: string;
  name: string;
  alias?: string | null;
  departmentId: string | null;
}
export interface VacGridDepartment {
  id: string;
  name: string;
  color: string | null;
  secondary: boolean;
}
export interface VacGridPeriod extends VacationRange {
  employeeId: string;
  status: string;
}
export type VacCell = VacationDayKind | null;
export interface VacGridRow {
  employeeId: string;
  name: string;
  alias?: string | null;
  cells: VacCell[];
  /** Estado de la petición de cada día (o null). */
  statuses: (string | null)[];
  work: number;
  fiesta: number;
}
export interface VacGridGroup {
  id: string;
  name: string;
  color: string | null;
  /** Máximo a la vez esta semana (null = no cuenta: comodín, palets). */
  max: number | null;
  /** De vacaciones cada día (solo días que descuentan: su fiesta la libraría igual). */
  counts: number[];
  over: boolean[];
  rows: VacGridRow[];
}

/** Una semana de vacaciones de toda la plantilla, por departamentos, con el máximo y lo que se pasa. */
export function vacationWeekGrid(args: {
  monday: DateStr;
  employees: VacGridEmployee[];
  departments: VacGridDepartment[];
  periods: VacGridPeriod[];
  campaign: Pick<VacationCampaignView, "defaultMax" | "departmentMax">;
  week: Pick<VacationWeekView, "maxOverride"> | null;
}): { days: DateStr[]; groups: VacGridGroup[]; overDays: number } {
  const days = Array.from({ length: 7 }, (_, i) => addDays(args.monday, i));
  const byEmployee = new Map<string, Map<DateStr, { kind: VacationDayKind; status: string }>>();
  for (const p of args.periods) {
    const m = byEmployee.get(p.employeeId) ?? new Map();
    for (const d of vacationSpan(p).days) if (d.date >= days[0]! && d.date <= days[6]!) m.set(d.date, { kind: d.kind, status: p.status });
    byEmployee.set(p.employeeId, m);
  }
  const known = new Set(args.departments.map((d) => d.id));
  const buckets: { dept: VacGridDepartment | null; emps: VacGridEmployee[] }[] = [
    ...args.departments.map((d) => ({ dept: d, emps: args.employees.filter((e) => e.departmentId === d.id) })),
    { dept: null, emps: args.employees.filter((e) => !e.departmentId || !known.has(e.departmentId)) },
  ];
  const groups: VacGridGroup[] = [];
  for (const { dept, emps } of buckets) {
    if (emps.length === 0) continue;
    const rows: VacGridRow[] = emps.map((e) => {
      const m = byEmployee.get(e.id);
      const cells = days.map((d) => m?.get(d)?.kind ?? null);
      return {
        employeeId: e.id,
        name: e.name,
        alias: e.alias,
        cells,
        statuses: days.map((d) => m?.get(d)?.status ?? null),
        work: cells.filter((c) => c === "work").length,
        fiesta: cells.filter((c) => c === "fiesta").length,
      };
    });
    const max = dept?.secondary ? null : maxAtOnce(args.campaign, dept?.id ?? null, args.week);
    const counts = days.map((_, i) => rows.filter((r) => r.cells[i] === "work").length);
    groups.push({
      id: dept?.id ?? "none",
      name: dept?.name ?? "Sin departamento",
      color: dept?.color ?? "#64748b",
      max,
      counts,
      over: counts.map((c) => max !== null && c > max),
      rows,
    });
  }
  return { days, groups, overDays: groups.reduce((n, g) => n + g.over.filter(Boolean).length, 0) };
}

/** Lunes de las semanas que tocan el año (la primera puede empezar en diciembre del anterior). */
export function yearWeeks(year: number): DateStr[] {
  const out: DateStr[] = [];
  for (let d = weekStart(`${year}-01-01` as DateStr); d <= `${year}-12-31`; d = addDays(d, 7)) out.push(d);
  return out;
}

// ---- Semanas con regla propia por fechas (de … a …) --------------------------------------------------------------

/** Lunes de todas las semanas que tocan las fechas de `from` a `to` (en cualquier orden). */
export function mondaysBetween(from: DateStr, to: DateStr): DateStr[] {
  const [a, b] = from <= to ? [from, to] : [to, from];
  const out: DateStr[] = [];
  for (let d = weekStart(a); d <= b; d = addDays(d, 7)) out.push(d);
  return out;
}

export interface WeekRuleRange {
  /** Lunes de la primera semana. */
  from: DateStr;
  /** Domingo de la última. */
  to: DateStr;
  weeks: number;
  blocked: boolean;
  reason: string | null;
  maxOverride: number | null;
}

/** Junta las semanas seguidas con la misma regla: «26 jul – 8 ago · Inventario · 2 semanas». */
export function groupWeekRules(weeks: VacationWeekView[]): WeekRuleRange[] {
  const sorted = [...weeks].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
  const out: WeekRuleRange[] = [];
  for (const w of sorted) {
    const last = out.at(-1);
    if (
      last &&
      addDays(last.to, 1) === w.weekStart &&
      last.blocked === w.blocked &&
      (last.reason ?? "") === (w.reason ?? "") &&
      last.maxOverride === w.maxOverride
    ) {
      last.to = addDays(w.weekStart, 6);
      last.weeks++;
    } else {
      out.push({ from: w.weekStart, to: addDays(w.weekStart, 6), weeks: 1, blocked: w.blocked, reason: w.reason, maxOverride: w.maxOverride });
    }
  }
  return out;
}

/** «26 jul – 8 ago». */
export const ruleRangeLabel = (r: Pick<WeekRuleRange, "from" | "to">): string => `${formatDayMonth(r.from)} – ${formatDayMonth(r.to)}`;

// ---- Solapes del año ---------------------------------------------------------------------------------------------

export interface VacationConflict {
  departmentId: string;
  departmentName: string;
  color: string | null;
  max: number;
  /** Días seguidos en los que pasa del máximo con las mismas personas. */
  from: DateStr;
  to: DateStr;
  employeeIds: string[];
  /** Periodos que tienen días que descuentan dentro del solape. */
  periodIds: string[];
}

/**
 * Días del año en que un departamento pasa del máximo a la vez (solo cuentan los días que descuentan), juntando los
 * seguidos con las mismas personas. Los departamentos secundarios no cuentan.
 */
export function vacationConflicts(args: {
  year: number;
  employees: VacGridEmployee[];
  departments: VacGridDepartment[];
  periods: (VacGridPeriod & { id: string })[];
  campaign: Pick<VacationCampaignView, "defaultMax" | "departmentMax">;
  weeks: VacationWeekView[];
}): VacationConflict[] {
  const deptOf = new Map(args.employees.map((e) => [e.id, e.departmentId]));
  const known = new Map(args.departments.map((d) => [d.id, d]));
  const weekRule = new Map(args.weeks.map((w) => [w.weekStart, w]));
  // día → departamento → [{ employeeId, periodId }]
  const off = new Map<DateStr, Map<string, { employeeId: string; periodId: string }[]>>();
  for (const p of args.periods) {
    const raw = deptOf.get(p.employeeId);
    if (raw === undefined) continue; // inactivo
    const dept = raw && known.has(raw) ? known.get(raw)! : null;
    if (dept?.secondary) continue;
    const key = dept?.id ?? "none";
    for (const d of vacationSpan(p).days) {
      if (d.kind !== "work" || !d.date.startsWith(`${args.year}-`)) continue;
      const byDept = off.get(d.date) ?? new Map();
      byDept.set(key, [...(byDept.get(key) ?? []), { employeeId: p.employeeId, periodId: p.id }]);
      off.set(d.date, byDept);
    }
  }
  const out: VacationConflict[] = [];
  const open = new Map<string, VacationConflict>(); // departamento → solape que sigue abierto
  const days = [...off.keys()].sort();
  for (const date of days) {
    for (const [key, list] of off.get(date)!) {
      const dept = key === "none" ? null : known.get(key)!;
      const max = maxAtOnce(args.campaign, dept?.id ?? null, weekRule.get(weekStart(date)) ?? null);
      if (list.length <= max) continue;
      const ids = [...new Set(list.map((x) => x.employeeId))].sort();
      const prev = open.get(key);
      if (prev && addDays(prev.to, 1) === date && prev.employeeIds.join() === ids.join() && prev.max === max) {
        prev.to = date;
        for (const x of list) if (!prev.periodIds.includes(x.periodId)) prev.periodIds.push(x.periodId);
        continue;
      }
      // Fin de semana o festivo en medio sin nadie que descuente: se junta con el anterior si son los mismos.
      if (prev && prev.employeeIds.join() === ids.join() && prev.max === max && diffDays(prev.to, date) <= 3) {
        prev.to = date;
        for (const x of list) if (!prev.periodIds.includes(x.periodId)) prev.periodIds.push(x.periodId);
        continue;
      }
      const c: VacationConflict = {
        departmentId: key,
        departmentName: dept?.name ?? "Sin departamento",
        color: dept?.color ?? "#64748b",
        max,
        from: date,
        to: date,
        employeeIds: ids,
        periodIds: [...new Set(list.map((x) => x.periodId))],
      };
      out.push(c);
      open.set(key, c);
    }
  }
  return out;
}

/** Estado del planning de cada día de un periodo: los que descuentan = vacaciones; su fiesta = fiesta. */
export function planningDaysFor(r: VacationRange): { date: DateStr; code: "VACATION" | "OFF" }[] {
  return vacationSpan(r).days.map((d) => ({ date: d.date, code: d.kind === "work" ? "VACATION" : "OFF" }));
}

export const MAX_MESSAGE_TEXT = 1000;
