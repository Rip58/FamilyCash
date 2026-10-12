/**
 * Recordatorios (Informe → Recordatorios): un texto que avisa al abrir la app a partir de un día y una hora.
 * Cada semana ciertos días (`weekdays`, 0 = lunes) o una sola vez (`date`). Puro y sin zod (también en el cliente).
 * El aviso sigue saliendo hasta que se marca «Hecho» (o hasta el siguiente día que toque) o se aplaza.
 */
import { type DateStr, WEEKDAY_LONG, addDays, formatDayLong, weekdayIndex } from "./dates";

export interface ReminderView {
  id: string;
  text: string;
  /** 0 = lunes … 6 = domingo; vacío = una sola vez. */
  weekdays: number[];
  date: DateStr | null;
  /** "HH:mm" (hora de Andorra). */
  time: string;
  active: boolean;
  /** Día del último aviso marcado como hecho. */
  lastDone: DateStr | null;
  /** Instante ISO hasta el que está aplazado. */
  snoozedUntil: string | null;
}

/** Último día (≤ ahora) en que tocaba avisar, o null si aún no ha tocado. */
export function lastOccurrence(r: Pick<ReminderView, "weekdays" | "date" | "time">, nowDate: DateStr, nowTime: string): DateStr | null {
  if (r.weekdays.length === 0) {
    if (!r.date) return null;
    return r.date < nowDate || (r.date === nowDate && r.time <= nowTime) ? r.date : null;
  }
  for (let i = 0; i <= 7; i++) {
    const d = addDays(nowDate, -i);
    if (r.weekdays.includes(weekdayIndex(d)) && (i > 0 || r.time <= nowTime)) return d;
  }
  return null;
}

/** Próximo día (> ahora) en que avisará, o null si ya no volverá a avisar. */
export function nextOccurrence(r: Pick<ReminderView, "weekdays" | "date" | "time">, nowDate: DateStr, nowTime: string): DateStr | null {
  if (r.weekdays.length === 0) {
    if (!r.date) return null;
    return r.date > nowDate || (r.date === nowDate && r.time > nowTime) ? r.date : null;
  }
  for (let i = 0; i < 8; i++) {
    const d = addDays(nowDate, i);
    if (r.weekdays.includes(weekdayIndex(d)) && (i > 0 || r.time > nowTime)) return d;
  }
  return null;
}

/** Si ahora tiene que salir el aviso, el día al que corresponde; si no, null. */
export function dueOccurrence(r: ReminderView, nowDate: DateStr, nowTime: string, nowIso: string): DateStr | null {
  if (!r.active) return null;
  if (r.snoozedUntil && r.snoozedUntil > nowIso) return null;
  const occ = lastOccurrence(r, nowDate, nowTime);
  if (!occ || r.lastDone === occ) return null;
  return occ;
}

/** «Cada lunes a las 22:00», «Lunes y jueves a las 22:00», «Cada día…», «El lunes 13 oct a las 22:00». */
export function describeReminder(r: Pick<ReminderView, "weekdays" | "date" | "time">): string {
  const at = `a las ${r.time}`;
  if (r.weekdays.length === 0) return r.date ? `El ${formatDayLong(r.date).toLowerCase()} ${at}` : at;
  const days = [...r.weekdays].sort((a, b) => a - b);
  if (days.length === 7) return `Cada día ${at}`;
  if (days.length === 1) return `Cada ${WEEKDAY_LONG[days[0]!]!.toLowerCase()} ${at}`;
  const names = days.map((d) => WEEKDAY_LONG[d]!.toLowerCase());
  const list = `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
  return `${list.charAt(0).toUpperCase()}${list.slice(1)} ${at}`;
}
