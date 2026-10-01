/**
 * Lineales (cómo tiene que quedar un lineal: foto + nota, opcionalmente hasta una fecha) y
 * pasos con foto de los protocolos. Tipos, validación (zod) y utilidades puras: se usa también en el cliente.
 */
import { z } from "zod";
import { type DateStr, diffDays, formatDayMonth, isDateStr } from "./dates";
import { photoInputSchema, type ReportPhotoView } from "./reports";
import { MAX_PHOTOS_PER_REPORT } from "./upload-rules";

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

// ---- Validación ----------------------------------------------------------

const idSchema = z.string().min(1).max(64);
const optionalId = z.string().max(64).nullish().transform((v) => v || null);
const untilSchema = z
  .string()
  .nullish()
  .transform((v) => v || null)
  .refine((v) => v === null || isDateStr(v), "Fecha no válida.");
const planogramText = z
  .string()
  .trim()
  .max(MAX_PLANOGRAM_TEXT, `La nota no puede superar ${MAX_PLANOGRAM_TEXT} caracteres.`);

export const createPlanogramSchema = z.object({
  locationId: optionalId,
  text: planogramText,
  until: untilSchema,
  photos: z
    .array(photoInputSchema)
    .min(1, "Añade al menos una foto del lineal.")
    .max(MAX_PHOTOS_PER_REPORT, `Máximo ${MAX_PHOTOS_PER_REPORT} fotos por lineal.`),
});

export const updatePlanogramSchema = z.object({
  id: idSchema,
  locationId: optionalId,
  text: planogramText,
  until: untilSchema,
});

export const locationSchema = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(1, "Escribe un nombre.").max(80, "Nombre demasiado largo."),
  active: z.boolean(),
});

export const stepsSchema = z
  .array(
    z
      .object({
        text: z.string().trim().max(MAX_STEP_TEXT, `Un paso no puede superar ${MAX_STEP_TEXT} caracteres.`),
        photo: photoInputSchema.nullish().transform((v) => v ?? null),
      })
      .refine((s) => s.text.length > 0 || s.photo !== null, "Cada paso necesita texto o foto."),
  )
  .max(MAX_STEPS, `Máximo ${MAX_STEPS} pasos.`)
  .default([]);

export type CreatePlanogramInput = z.input<typeof createPlanogramSchema>;
export type StepInput = NonNullable<z.input<typeof stepsSchema>>[number];

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

/** Pathnames de foto que estaban y ya no están (para borrarlos del almacenamiento). */
export function removedPathnames(before: (string | null)[], after: (string | null)[]): string[] {
  const keep = new Set(after.filter((p): p is string => !!p));
  return [...new Set(before.filter((p): p is string => !!p && !keep.has(p)))];
}
