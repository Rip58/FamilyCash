/**
 * Ficha del empleado: tipos, validación (zod) y utilidades puras
 * (línea de tiempo, agrupación por mes, filtro por categoría).
 * Sin acceso a datos; se usa también en el cliente.
 */
import { z } from "zod";
import { type DateStr, formatMonthYear, isDateStr, madridInstant, madridParts } from "./dates";
import { LEAVE_TYPES, validateLeaveDates } from "./leave";
import { photoInputSchema, type ReportPhotoView, type ReportView } from "./reports";
import { MAX_PHOTOS_PER_REPORT } from "./upload-rules";

export const NOTE_CATEGORIES = ["NOTE", "INCIDENT", "PRAISE", "TALK"] as const;
export type NoteCategory = (typeof NOTE_CATEGORIES)[number];

export const CATEGORY_META: Record<NoteCategory, { label: string; color: string }> = {
  NOTE: { label: "Nota", color: "#64748b" },
  INCIDENT: { label: "Incidencia", color: "#dc2626" },
  PRAISE: { label: "Felicitación", color: "#16a34a" },
  TALK: { label: "Conversación", color: "#4f46e5" },
};

export type FileTab = "datos" | "historial" | "peticiones";

export function isFileTab(v: string | undefined): v is FileTab {
  return v === "datos" || v === "historial" || v === "peticiones";
}

export const MAX_NOTE_TEXT = 2000;

export function isNoteCategory(v: string): v is NoteCategory {
  return (NOTE_CATEGORIES as readonly string[]).includes(v);
}

export interface NoteView {
  id: string;
  /** Instante ISO (UTC) del evento. */
  occurredAt: string;
  category: NoteCategory;
  text: string;
  photos: ReportPhotoView[];
}

export type TimelineItem =
  | { kind: "note"; at: string; note: NoteView }
  | { kind: "report"; at: string; report: ReportView };

/** Notas de ficha + avisos del empleado, más reciente primero. */
export function buildTimeline(notes: NoteView[], reports: ReportView[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...notes.map((note): TimelineItem => ({ kind: "note", at: note.occurredAt, note })),
    ...reports.map(
      (report): TimelineItem => ({
        kind: "report",
        at: madridInstant(report.createdDate, report.createdTime).toISOString(),
        report,
      }),
    ),
  ];
  return items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** Filtro por categoría. null = todo; "REPORT" = solo avisos del día. */
export function filterTimeline(items: TimelineItem[], filter: NoteCategory | "REPORT" | null): TimelineItem[] {
  if (!filter) return items;
  if (filter === "REPORT") return items.filter((i) => i.kind === "report");
  return items.filter((i) => i.kind === "note" && i.note.category === filter);
}

export interface MonthGroup {
  key: string;
  label: string;
  items: TimelineItem[];
}

/** Agrupa (ya ordenados) por mes natural en Madrid. */
export function groupByMonth(items: TimelineItem[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const it of items) {
    const date: DateStr = madridParts(new Date(it.at)).date;
    const key = date.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: formatMonthYear(date), items: [] };
      groups.push(g);
    }
    g.items.push(it);
  }
  return groups;
}

// ---- Validación ----------------------------------------------------------

const idSchema = z.string().min(1).max(64);
const dateSchema = z.string().refine((v) => isDateStr(v), "Fecha inválida");
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida");
const textSchema = z
  .string()
  .trim()
  .min(1, "Escribe el texto de la nota.")
  .max(MAX_NOTE_TEXT, `La nota no puede superar ${MAX_NOTE_TEXT} caracteres.`);
const photosSchema = z
  .array(photoInputSchema)
  .max(MAX_PHOTOS_PER_REPORT, `Máximo ${MAX_PHOTOS_PER_REPORT} fotos por nota.`)
  .default([]);

export const createNoteSchema = z.object({
  employeeId: idSchema,
  date: dateSchema,
  time: timeSchema,
  category: z.enum(NOTE_CATEGORIES),
  text: textSchema,
  photos: photosSchema,
});

export const updateNoteSchema = z.object({
  id: idSchema,
  date: dateSchema,
  time: timeSchema,
  category: z.enum(NOTE_CATEGORIES),
  text: textSchema,
  photos: photosSchema,
});

export const deleteNoteSchema = z.object({ id: idSchema });
export const deleteNotePhotoSchema = z.object({ photoId: idSchema });

const noteField = z
  .string()
  .trim()
  .max(500, "La nota no puede superar 500 caracteres.")
  .nullish()
  .transform((v) => v || null);

const requestBase = z.object({
  type: z.enum(LEAVE_TYPES),
  dateFrom: dateSchema,
  dateTo: dateSchema,
  note: noteField,
  requestedAt: dateSchema,
});

const withDates = <T extends z.ZodType<{ type: (typeof LEAVE_TYPES)[number]; dateFrom: string; dateTo: string }>>(s: T) =>
  s.superRefine((v, ctx) => {
    const err = validateLeaveDates(v.type, v.dateFrom, v.dateTo);
    if (err) ctx.addIssue({ code: "custom", message: err, path: ["dateTo"] });
  });

export const createRequestSchema = withDates(requestBase.extend({ employeeId: idSchema }));
export const updateRequestSchema = withDates(requestBase.extend({ id: idSchema }));
export const requestIdSchema = z.object({ id: idSchema });
export const denyRequestSchema = z.object({
  id: idSchema,
  decisionNote: z.string().trim().max(300, "El motivo no puede superar 300 caracteres.").nullish().transform((v) => v || null),
});
export const approveRequestSchema = z.object({ id: idSchema });

export type CreateNoteInput = z.input<typeof createNoteSchema>;
export type UpdateNoteInput = z.input<typeof updateNoteSchema>;
export type CreateRequestInput = z.input<typeof createRequestSchema>;
export type UpdateRequestInput = z.input<typeof updateRequestSchema>;

// ---- Vistas de peticiones ------------------------------------------------

export interface RequestView {
  id: string;
  employeeId: string;
  employeeName: string;
  type: (typeof LEAVE_TYPES)[number];
  dateFrom: DateStr;
  dateTo: DateStr;
  note: string | null;
  requestedAt: DateStr;
  status: "PENDING" | "APPROVED" | "DENIED";
  decisionNote: string | null;
  /** Nº de días de calendario cambiados al aprobar. */
  appliedCount: number;
}

/** Orden de la lista: pendientes primero (antiguas antes), luego el resto por fecha desc. */
export function sortRequests<T extends { status: string; requestedAt: string; dateFrom: string }>(list: T[]): T[] {
  const rank = (s: string) => (s === "PENDING" ? 0 : 1);
  return [...list].sort((a, b) => {
    if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
    if (a.status === "PENDING") return a.dateFrom < b.dateFrom ? -1 : a.dateFrom > b.dateFrom ? 1 : 0;
    return a.requestedAt < b.requestedAt ? 1 : a.requestedAt > b.requestedAt ? -1 : 0;
  });
}
