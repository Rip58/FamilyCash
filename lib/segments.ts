/**
 * Lógica pura de tramos de trabajo y de edición de un DayEntry.
 * Las horas se comparan en "minutos desde el inicio del turno" para poder
 * cruzar la medianoche (21:30 = 0, 00:00 = 150, 06:30 = 540).
 * El "día efectivo" sigue calculándose solo en lib/schedule.ts.
 */
import type { DateStr } from "./dates";
import {
  type DayEntryLite,
  type EmployeeLite,
  type SegmentLite,
  type StatusTypeLite,
  getEffectiveDay,
  sameIds,
} from "./schedule";

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface ShiftTimes {
  shiftStart: string;
  shiftEnd: string;
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Minutos transcurridos desde el inicio del turno (0–1439). */
export function minutesFromShiftStart(time: string, shiftStart: string): number {
  return (((toMinutes(time) - toMinutes(shiftStart)) % 1440) + 1440) % 1440;
}

/** Inversa de `minutesFromShiftStart`. */
export function timeFromOffset(offset: number, shiftStart: string): string {
  const total = (toMinutes(shiftStart) + offset) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Duración del turno en minutos (24 h si inicio == fin). */
export function shiftLength(shift: ShiftTimes): number {
  const len = minutesFromShiftStart(shift.shiftEnd, shift.shiftStart);
  return len === 0 ? 1440 : len;
}

export interface TimeSpan {
  id?: string;
  start: string;
  end: string;
}

/** Devuelve un mensaje de error en español o null si el tramo es válido. */
export function validateSegmentSpan(others: TimeSpan[], seg: TimeSpan, shift: ShiftTimes): string | null {
  if (!TIME_RE.test(seg.start) || !TIME_RE.test(seg.end)) return "Indica hora de inicio y de fin.";
  const len = shiftLength(shift);
  const s = minutesFromShiftStart(seg.start, shift.shiftStart);
  // Un fin igual al inicio de turno (offset 0) es "siempre" inválido: e <= s.
  const e = minutesFromShiftStart(seg.end, shift.shiftStart);
  if (s >= len || e > len) return `Fuera del turno (${shift.shiftStart}–${shift.shiftEnd}).`;
  if (e <= s) return "La hora de fin debe ser posterior al inicio.";
  for (const o of others) {
    if (seg.id !== undefined && o.id === seg.id) continue;
    const os = minutesFromShiftStart(o.start, shift.shiftStart);
    const oe = minutesFromShiftStart(o.end, shift.shiftStart);
    if (s < oe && os < e) return `Se solapa con ${o.start}–${o.end}.`;
  }
  return null;
}

/** Inicio propuesto para un tramo nuevo: fin del último, o inicio de turno. */
export function nextSegmentStart(spans: TimeSpan[], shift: ShiftTimes): string {
  if (spans.length === 0) return shift.shiftStart;
  const maxEnd = Math.max(...spans.map((sp) => minutesFromShiftStart(sp.end, shift.shiftStart)));
  return maxEnd === 0 ? shift.shiftStart : timeFromOffset(maxEnd, shift.shiftStart);
}

/** Ordena por inicio (en minutos desde inicio de turno) y renumera sortOrder. */
export function sortSegments<T extends { start: string; sortOrder: number }>(segs: T[], shiftStart: string): T[] {
  return [...segs]
    .sort((a, b) => minutesFromShiftStart(a.start, shiftStart) - minutesFromShiftStart(b.start, shiftStart))
    .map((s, i) => ({ ...s, sortOrder: i }));
}

/** ¿La hora de salida es posterior al fin de turno (se queda más) o anterior (se va antes)? */
export function leftKind(leftAt: string, shift: ShiftTimes): "more" | "less" {
  return minutesFromShiftStart(leftAt, shift.shiftStart) > shiftLength(shift) ? "more" : "less";
}

// ---- Edición de un DayEntry ---------------------------------------------

export type SegmentWithId = SegmentLite & { id: string };

export type EntryPatch =
  | { kind: "status"; statusTypeId: string; reason?: string | null; present?: boolean }
  | { kind: "reason"; reason: string | null }
  /** `extraDepartmentIds` = otros departamentos que también cubre (ausente = no cambiarlos). */
  | { kind: "department"; departmentId: string | null; extraDepartmentIds?: string[] }
  | { kind: "times"; arrivedAt: string | null; leftAt: string | null; timeReason: string | null }
  | { kind: "note"; note: string | null }
  | { kind: "overtime"; extraMinutes: number | null; extraNote: string | null }
  | { kind: "attendance"; present: boolean }
  | { kind: "segmentAdd"; segment: SegmentWithId }
  | { kind: "segmentUpdate"; segment: SegmentWithId }
  | { kind: "segmentDelete"; id: string };

const clean = (v: string | null | undefined): string | null => {
  const t = v?.trim();
  return t ? t : null;
};

/** Entry "en blanco" con los valores efectivos actuales (primera edición). */
export function baseEntry(employee: EmployeeLite, date: DateStr, statusTypes: StatusTypeLite[]): DayEntryLite {
  const eff = getEffectiveDay(employee, date, null, statusTypes);
  return {
    employeeId: employee.id,
    date,
    statusTypeId: eff.status.id,
    departmentId: null,
    extraDepartmentIds: [],
    reason: null,
    note: null,
    arrivedAt: null,
    leftAt: null,
    timeReason: null,
    extraMinutes: null,
    extraNote: null,
    present: null,
    actualStatusTypeId: null,
    segments: [],
  };
}

/** Aplica un cambio y devuelve el nuevo entry (sin decidir si es redundante). */
export function applyEntryPatch(
  current: DayEntryLite | undefined | null,
  employee: EmployeeLite,
  date: DateStr,
  statusTypes: StatusTypeLite[],
  patch: EntryPatch,
  shiftStart: string,
): DayEntryLite {
  const e: DayEntryLite = current
    ? { ...current, segments: [...current.segments] }
    : baseEntry(employee, date, statusTypes);
  switch (patch.kind) {
    case "status": {
      // Desde Hoy: el planning (statusTypeId) NO cambia; se guarda lo que pasó de verdad si no cuadra
      // y queda validado. Elegir el mismo estado que el planning vuelve a "como el planning".
      e.actualStatusTypeId = patch.statusTypeId === e.statusTypeId ? null : patch.statusTypeId;
      if (patch.reason !== undefined) e.reason = clean(patch.reason);
      // Vuelve a trabajar como estaba previsto: el motivo de la ausencia ya no aplica.
      const working = (id: string) => statusTypes.find((s) => s.id === id)?.isWorking;
      if (working(patch.statusTypeId) && working(e.statusTypeId)) e.reason = null;
      e.present = true;
      break;
    }
    case "attendance":
      e.present = patch.present ? true : null;
      break;
    case "reason":
      e.reason = clean(patch.reason);
      break;
    case "department": {
      const main = patch.departmentId ?? employee.defaultDepartmentId;
      const extras = [...new Set(patch.extraDepartmentIds ?? e.extraDepartmentIds ?? [])].filter((id) => id !== main);
      const habitualExtras = (employee.defaultExtraDepartmentIds ?? []).filter((id) => id !== main);
      if (main === employee.defaultDepartmentId && sameIds(extras, habitualExtras)) {
        // Como siempre: puesto y «también cubre» habituales.
        e.departmentId = null;
        e.extraDepartmentIds = [];
      } else {
        // Se apunta el principal aunque sea el habitual: así esa noche mandan los extras elegidos (también ninguno).
        e.departmentId = main === employee.defaultDepartmentId && habitualExtras.length === 0 ? null : main;
        e.extraDepartmentIds = extras;
      }
      break;
    }
    case "times":
      e.arrivedAt = patch.arrivedAt || null;
      e.leftAt = patch.leftAt || null;
      e.timeReason = clean(patch.timeReason);
      break;
    case "note":
      e.note = clean(patch.note);
      break;
    case "overtime":
      e.extraMinutes = patch.extraMinutes && patch.extraMinutes > 0 ? patch.extraMinutes : null;
      e.extraNote = clean(patch.extraNote);
      break;
    case "segmentAdd":
      e.segments = sortSegments([...e.segments, patch.segment], shiftStart);
      break;
    case "segmentUpdate":
      e.segments = sortSegments(
        e.segments.map((s) => (s.id === patch.segment.id ? patch.segment : s)),
        shiftStart,
      );
      break;
    case "segmentDelete":
      e.segments = sortSegments(
        e.segments.filter((s) => s.id !== patch.id),
        shiftStart,
      );
      break;
  }
  return e;
}

/** ¿El entry coincide exactamente con el patrón (y por tanto sobra)? */
export function isEntryRedundant(
  entry: DayEntryLite,
  employee: EmployeeLite,
  date: DateStr,
  statusTypes: StatusTypeLite[],
): boolean {
  const pattern = getEffectiveDay(employee, date, null, statusTypes);
  const dept = entry.departmentId ?? null;
  return (
    entry.statusTypeId === pattern.status.id &&
    ((dept === null && (entry.extraDepartmentIds ?? []).length === 0) ||
      (dept === employee.defaultDepartmentId && sameIds(entry.extraDepartmentIds ?? [], employee.defaultExtraDepartmentIds ?? []))) &&
    !clean(entry.reason) &&
    !clean(entry.note) &&
    !entry.arrivedAt &&
    !entry.leftAt &&
    !clean(entry.timeReason) &&
    !(entry.extraMinutes && entry.extraMinutes > 0) &&
    !clean(entry.extraNote) &&
    entry.present !== true &&
    !entry.actualStatusTypeId &&
    entry.segments.length === 0
  );
}

export function segmentName(
  seg: Pick<SegmentLite, "sectionId" | "label">,
  sectionNames: Map<string, string>,
): string {
  return (seg.sectionId ? sectionNames.get(seg.sectionId) : null) ?? seg.label ?? "Tarea";
}

/**
 * Elegir varios departamentos en una noche: el primero es el principal (cuenta como "dónde trabaja");
 * tocar uno elegido lo quita (si era el principal, pasa a serlo el siguiente) y uno sin elegir lo añade.
 * Sin ninguno elegido vuelve al habitual (main null).
 */
export function toggleDepartment(
  main: string | null,
  extras: string[],
  id: string,
): { main: string | null; extras: string[] } {
  const all = [...new Set([...(main ? [main] : []), ...extras])];
  const next = all.includes(id) ? all.filter((x) => x !== id) : [...all, id];
  return { main: next[0] ?? null, extras: next.slice(1) };
}
