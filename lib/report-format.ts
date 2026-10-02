/**
 * Avisos con foto: tipos y utilidades puras SIN zod (se usan en componentes de cliente; los esquemas
 * de validación viven en lib/reports.ts para no meter zod en el JavaScript del móvil).
 */
import { addDays, type DateStr } from "./dates";

export const MAX_REPORT_TEXT = 1000;

export interface ReportPhotoView {
  id: string;
  url: string;
  width: number;
  height: number;
  size: number;
}

export interface ReportView {
  id: string;
  date: DateStr;
  text: string;
  employeeId: string | null;
  employeeName: string | null;
  sectionId: string | null;
  sectionName: string | null;
  /** Hora de creación "HH:mm" (Europe/Madrid). */
  createdTime: string;
  /** Día civil de creación (Madrid), para mostrar la fecha en el listado. */
  createdDate: DateStr;
  photos: ReportPhotoView[];
}

// ---- Utilidades ----------------------------------------------------------

export function photoCountLabel(n: number): string {
  return n === 1 ? "1 foto" : `${n} fotos`;
}

/** Líneas de texto para compartir (WhatsApp) con los avisos de la noche. */
export function reportsToTextLines(reports: ReportView[]): string[] {
  if (reports.length === 0) return [];
  const L = ["", "*Avisos con foto*"];
  for (const r of reports) {
    const who = r.employeeName ? `${r.employeeName}: ` : "";
    const where = r.sectionName ? ` [${r.sectionName}]` : "";
    const photos = r.photos.length > 0 ? ` (${photoCountLabel(r.photos.length)})` : "";
    L.push(`• ${who}${r.text.replace(/\s*\n\s*/g, " ")}${where}${photos}`);
  }
  return L;
}

/**
 * Fecha límite para "borrar avisos anteriores a N meses": los avisos con
 * `date` < cutoff se borran. Resta N meses naturales a `today`.
 */
export function purgeCutoff(today: DateStr, months: number): DateStr {
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) - months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const nd = Math.min(d, lastDay);
  return `${ny}-${String(nm).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

export const PAGE_SIZE = 20;

/** Rango por defecto del listado: últimos 30 días. */
export function defaultRange(today: DateStr): { from: DateStr; to: DateStr } {
  return { from: addDays(today, -30), to: today };
}
