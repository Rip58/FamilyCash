/**
 * Vacaciones (lógica pura, sin BD ni zod): campaña anual, PIN fijo de cada empleado y máximo a la vez.
 * Se usa en el servidor, en Ajustes y en los tests.
 */
import { type DateStr, addDays, formatDayMonth, isoWeekNumber, weekStart } from "./dates";

/** La página de los empleados (/vacaciones) llega en la fase 2: hasta entonces no se ofrece mandar el enlace. */
export const VACATION_PAGE_READY = false;

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
