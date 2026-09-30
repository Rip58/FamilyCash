/**
 * Toda la lógica de fechas de la app. Zona horaria: Europe/Madrid.
 *
 * Los días de turno se representan como string "YYYY-MM-DD" (`DateStr`).
 * El turno pertenece al día en que EMPIEZA (lunes 21:30 -> martes 06:30 = lunes).
 * Las operaciones de calendario (sumar días, día de la semana...) se hacen en
 * UTC sobre la fecha "civil", así que no dependen del huso del servidor ni de
 * los cambios de hora.
 */

export const TIME_ZONE = "Europe/Madrid";

/** Fecha civil "YYYY-MM-DD". */
export type DateStr = string;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateStr(value: string): value is DateStr {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function parse(date: DateStr): Date {
  if (!isDateStr(date)) throw new Error(`Fecha inválida: ${date}`);
  const m = DATE_RE.exec(date)!;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function fmt(dt: Date): DateStr {
  return dt.toISOString().slice(0, 10);
}

const madridFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Fecha y hora de pared en Madrid para un instante. */
export function madridParts(now: Date): { date: DateStr; hour: number; minute: number } {
  const parts: Record<string, string> = {};
  for (const p of madridFormatter.formatToParts(now)) parts[p.type] = p.value;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
}

/** Día civil actual en Madrid (sin corte de rollover). */
export function madridToday(now: Date = new Date()): DateStr {
  return madridParts(now).date;
}

/** Suma (o resta) días a una fecha. */
export function addDays(date: DateStr, n: number): DateStr {
  const dt = parse(date);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fmt(dt);
}

/** Antes de `rolloverHour` (hora de Madrid) "hoy" es la noche anterior. */
export function operationalToday(now: Date, rolloverHour: number): DateStr {
  const { date, hour } = madridParts(now);
  return hour < rolloverHour ? addDays(date, -1) : date;
}

/** 0 = lunes … 6 = domingo. */
export function weekdayIndex(date: DateStr): number {
  return (parse(date).getUTCDay() + 6) % 7;
}

/** Lunes de la semana que contiene `date`. */
export function weekStart(date: DateStr): DateStr {
  return addDays(date, -weekdayIndex(date));
}

/** Los 7 días (lunes a domingo) de la semana que contiene `date`. */
export function weekDays(date: DateStr): DateStr[] {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Número de semana ISO 8601 (y año ISO). */
export function isoWeek(date: DateStr): { year: number; week: number } {
  const dt = parse(date);
  const dow = (dt.getUTCDay() + 6) % 7; // 0 = lunes
  dt.setUTCDate(dt.getUTCDate() - dow + 3); // jueves de esa semana
  const year = dt.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstDow = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDow + 3);
  const week = 1 + Math.round((dt.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return { year, week };
}

export function isoWeekNumber(date: DateStr): number {
  return isoWeek(date).week;
}

// ---- Formateo en español -------------------------------------------------

export const WEEKDAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"] as const;
export const WEEKDAY_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;
export const WEEKDAY_LONG = [
  "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo",
] as const;
export const MONTH_SHORT = [
  "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic",
] as const;

function dayOfMonth(date: DateStr): number {
  return parse(date).getUTCDate();
}
function monthShort(date: DateStr): string {
  return MONTH_SHORT[parse(date).getUTCMonth()]!;
}

/** "Lunes 29 sep" */
export function formatDayLong(date: DateStr): string {
  return `${WEEKDAY_LONG[weekdayIndex(date)]} ${dayOfMonth(date)} ${monthShort(date)}`;
}

/** "Lun 29" */
export function formatDayShort(date: DateStr): string {
  return `${WEEKDAY_SHORT[weekdayIndex(date)]} ${dayOfMonth(date)}`;
}

/** "29 sep" */
export function formatDayMonth(date: DateStr): string {
  return `${dayOfMonth(date)} ${monthShort(date)}`;
}

/** "29 sep – 5 oct" para la semana que contiene `date`. */
export function formatWeekRange(date: DateStr): string {
  const days = weekDays(date);
  return `${formatDayMonth(days[0]!)} – ${formatDayMonth(days[6]!)}`;
}

/** Letra del día de la semana: "L", "M", "X"… */
export function weekdayLetter(date: DateStr): string {
  return WEEKDAY_LETTERS[weekdayIndex(date)]!;
}

// ---- Conversión con Prisma (@db.Date) ------------------------------------

/** "YYYY-MM-DD" -> Date a medianoche UTC (lo que Prisma guarda en @db.Date). */
export function toDbDate(date: DateStr): Date {
  return parse(date);
}

/** Date de @db.Date (medianoche UTC) -> "YYYY-MM-DD". */
export function fromDbDate(dt: Date): DateStr {
  return fmt(dt);
}

// ---- Instantes (fecha + hora de pared en Madrid) --------------------------

/**
 * Instante UTC correcto para una fecha y hora de pared en Madrid
 * (respeta el horario de verano/invierno).
 */
export function madridInstant(date: DateStr, time: string): Date {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!m) throw new Error(`Hora inválida: ${time}`);
  const base = parse(date);
  const wall = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), Number(m[1]), Number(m[2]));
  let guess = wall;
  for (let i = 0; i < 3; i++) {
    const p = madridParts(new Date(guess));
    const d = parse(p.date);
    const shown = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), p.hour, p.minute);
    if (shown === wall) break;
    guess += wall - shown;
  }
  return new Date(guess);
}

/** Hora "HH:mm" de pared en Madrid para un instante. */
export function madridTime(instant: Date): string {
  const p = madridParts(instant);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** "Mar 29 sep · 23:40" (día de la semana abreviado, día, mes y hora en Madrid). */
export function formatStamp(instant: Date): string {
  const date = madridParts(instant).date;
  return `${WEEKDAY_SHORT[weekdayIndex(date)]} ${formatDayMonth(date)} · ${madridTime(instant)}`;
}

export const MONTH_LONG = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;

/** "Septiembre 2026" para una fecha civil. */
export function formatMonthYear(date: DateStr): string {
  const dt = parse(date);
  return `${MONTH_LONG[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

/** Días entre dos fechas civiles (b - a). */
export function diffDays(a: DateStr, b: DateStr): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);
}
