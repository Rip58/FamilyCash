/**
 * Lineales y pasos de protocolo: tipos y utilidades puras SIN zod (para componentes de cliente).
 * Los esquemas de validación están en lib/planograms.ts.
 */
import { type DateStr, diffDays, formatDayMonth } from "./dates";
import type { ReportPhotoView } from "./report-format";

export const MAX_PLANOGRAM_TEXT = 1000;
export const MAX_STEP_TEXT = 2000;
export const MAX_STEPS = 60;

export interface PlanogramView {
  id: string;
  locationId: string | null;
  locationName: string | null;
  text: string;
  until: DateStr | null;
  createdDate: DateStr;
  photos: ReportPhotoView[];
}

export interface LocationOption {
  id: string;
  name: string;
  active: boolean;
}

export interface StepPhoto {
  url: string;
  pathname: string;
  width: number;
  height: number;
  size: number;
}

export interface ProtocolStepView {
  id: string;
  text: string;
  photo: StepPhoto | null;
}

// ---- Utilidades ----------------------------------------------------------

export type UntilState = "none" | "ok" | "soon" | "expired";

/** Estado de la fecha "hasta": caducado si ya pasó, "pronto" si quedan 3 días o menos. */
export function untilState(until: DateStr | null, today: DateStr): UntilState {
  if (!until) return "none";
  const left = diffDays(today, until);
  if (left < 0) return "expired";
  return left <= 3 ? "soon" : "ok";
}

/** "Hasta 15 oct" / "Hasta hoy" / "Hasta mañana" / "Caducado el 15 oct". */
export function untilLabel(until: DateStr | null, today: DateStr): string | null {
  if (!until) return null;
  const left = diffDays(today, until);
  if (left < 0) return `Caducado el ${formatDayMonth(until)}`;
  if (left === 0) return "Hasta hoy";
  if (left === 1) return "Hasta mañana";
  return `Hasta ${formatDayMonth(until)}`;
}

