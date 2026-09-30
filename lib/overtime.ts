/**
 * Lógica pura de horas extra. Se guardan en minutos (DayEntry.extraMinutes),
 * en pasos de 15. No calcula nómina: solo registra y suma lo apuntado.
 */
import { minutesFromShiftStart, shiftLength, type ShiftTimes } from "./segments";

export const OVERTIME_STEP = 15;
export const OVERTIME_MAX = 720;

/** "45 min", "1 h", "1 h 30 min"; con `signed` antepone "+". */
export function formatOvertime(minutes: number, signed = false): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  const text = h === 0 ? `${r} min` : r === 0 ? `${h} h` : `${h} h ${r} min`;
  return signed ? `+${text}` : text;
}

/** Ajusta a múltiplo de 15 dentro de 0–720. */
export function clampOvertime(minutes: number): number {
  const stepped = Math.round(minutes / OVERTIME_STEP) * OVERTIME_STEP;
  return Math.min(OVERTIME_MAX, Math.max(0, stepped));
}

/** ¿Es un valor válido para guardar (0–720, múltiplo de 15)? */
export function isValidOvertime(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= 0 && minutes <= OVERTIME_MAX && minutes % OVERTIME_STEP === 0;
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

/** Valor normalizado para guardar: null si no hay horas extra. */
export function normalizeOvertime(minutes: number | null | undefined): number | null {
  return minutes && minutes > 0 ? minutes : null;
}

interface WithExtra {
  employeeId: string;
  extraMinutes?: number | null;
}

/** Total de minutos apuntados. */
export function totalOvertime(items: { extraMinutes?: number | null }[]): number {
  return items.reduce((n, i) => n + (i.extraMinutes && i.extraMinutes > 0 ? i.extraMinutes : 0), 0);
}

/** Suma por empleado (solo con >0). */
export function sumOvertimeByEmployee(entries: WithExtra[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of entries) {
    if (e.extraMinutes && e.extraMinutes > 0) out.set(e.employeeId, (out.get(e.employeeId) ?? 0) + e.extraMinutes);
  }
  return out;
}
