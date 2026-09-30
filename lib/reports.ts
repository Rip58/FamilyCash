/**
 * Avisos con foto: tipos, validación (zod) y utilidades puras.
 * Sin acceso a datos ni a APIs de servidor (se usa también en el cliente).
 */
import { z } from "zod";
import { addDays, isDateStr, type DateStr } from "./dates";
import { MAX_PHOTOS_PER_REPORT, isPhotoUrlFor } from "./upload-rules";

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

// ---- Validación ----------------------------------------------------------

const idSchema = z.string().min(1).max(64);
const dateSchema = z.string().refine((v) => isDateStr(v), "Fecha inválida");
const textSchema = z
  .string()
  .trim()
  .min(1, "Escribe una nota para el aviso.")
  .max(MAX_REPORT_TEXT, `La nota no puede superar ${MAX_REPORT_TEXT} caracteres.`);

export const photoInputSchema = z
  .object({
    url: z.string().min(1).max(600),
    pathname: z.string().min(1).max(200),
    width: z.number().int().min(1).max(20000),
    height: z.number().int().min(1).max(20000),
    size: z.number().int().min(0).max(50 * 1024 * 1024).optional().default(0),
  })
  .refine((p) => isPhotoUrlFor(p.url, p.pathname), "Foto no válida.");

export const createReportSchema = z.object({
  date: dateSchema,
  text: textSchema,
  employeeId: idSchema.nullish().transform((v) => v || null),
  sectionId: idSchema.nullish().transform((v) => v || null),
  photos: z.array(photoInputSchema).max(MAX_PHOTOS_PER_REPORT, `Máximo ${MAX_PHOTOS_PER_REPORT} fotos por aviso.`).default([]),
});

export const updateReportSchema = z.object({
  id: idSchema,
  text: textSchema,
  employeeId: idSchema.nullish().transform((v) => v || null),
  sectionId: idSchema.nullish().transform((v) => v || null),
});

export const deleteReportSchema = z.object({ id: idSchema });
export const deleteReportPhotoSchema = z.object({ photoId: idSchema });
export const purgeReportsSchema = z.object({ months: z.number().int().min(1).max(120) });

export type CreateReportInput = z.input<typeof createReportSchema>;

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
