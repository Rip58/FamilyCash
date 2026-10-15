/**
 * Lógica pura de horas extra. Se guardan en minutos (DayEntry.extraMinutes),
 * en pasos de 15. NEGATIVO = retraso (horas que debe, p. ej. si llega tarde).
 * No calcula nómina: solo registra y suma lo apuntado (los totales son netos).
 */
import { minutesFromShiftStart, shiftLength, type ShiftTimes } from "./segments";

export const OVERTIME_STEP = 15;
export const OVERTIME_MAX = 720;
/** Retraso máximo (−8 h). */
export const OVERTIME_MIN = -480;

/** "45 min", "1 h", "1 h 30 min"; negativo = "−30 min" (retraso); con `signed` antepone "+" a los positivos. */
export function formatOvertime(minutes: number, signed = false): string {
  const neg = Math.round(minutes) < 0;
  const m = Math.abs(Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  const text = h === 0 ? `${r} min` : r === 0 ? `${h} h` : `${h} h ${r} min`;
  return neg ? `−${text}` : signed ? `+${text}` : text;
}

/** Ajusta a múltiplo de 15 dentro de −480–720. */
export function clampOvertime(minutes: number): number {
  const stepped = Math.round(minutes / OVERTIME_STEP) * OVERTIME_STEP;
  return Math.min(OVERTIME_MAX, Math.max(OVERTIME_MIN, stepped)) || 0;
}

/** ¿Es un valor válido para guardar (−480–720, múltiplo de 15)? */
export function isValidOvertime(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= OVERTIME_MIN && minutes <= OVERTIME_MAX && minutes % OVERTIME_STEP === 0;
}

/**
 * Propuesta de horas extra a partir de "Sale a": si la salida es posterior al
 * fin de turno (cruzando medianoche), la diferencia redondeada a 15 min.
 * Devuelve null si no hay propuesta (sale a su hora, antes, o incoherente).
 */
export function proposeOvertime(leftAt: string | null | undefined, shift: ShiftTimes): number | null {
  if (!leftAt) return null;
  const delta = minutesFromShiftStart(leftAt, shift.shiftStart) - shiftLength(shift);
  // Salidas "antes de empezar el turno" dan deltas enormes: se descartan.
  if (delta <= 0 || delta > OVERTIME_MAX) return null;
  const rounded = clampOvertime(delta);
  return rounded > 0 ? rounded : null;
}

/** Valor normalizado para guardar: null si no hay ni horas extra ni retraso. */
export function normalizeOvertime(minutes: number | null | undefined): number | null {
  return minutes ? minutes : null;
}

interface WithExtra {
  employeeId: string;
  extraMinutes?: number | null;
}

/** Total neto de minutos apuntados (los retrasos restan). */
export function totalOvertime(items: { extraMinutes?: number | null }[]): number {
  return items.reduce((n, i) => n + (i.extraMinutes ?? 0), 0);
}

/** Suma neta por empleado (solo los que tienen algo apuntado). */
export function sumOvertimeByEmployee(entries: WithExtra[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of entries) {
    if (e.extraMinutes) out.set(e.employeeId, (out.get(e.employeeId) ?? 0) + e.extraMinutes);
  }
  return out;
}
