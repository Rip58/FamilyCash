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
