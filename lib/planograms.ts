/**
 * Lineales (cómo tiene que quedar un lineal: foto + nota, opcionalmente hasta una fecha) y pasos con foto
 * de los protocolos: validación (zod). Tipos y utilidades sin zod en lib/planogram-format.ts.
 */
import { z } from "zod";
import { isDateStr } from "./dates";
import { MAX_PLANOGRAM_TEXT, MAX_STEP_TEXT, MAX_STEPS } from "./planogram-format";
import { photoInputSchema } from "./reports";
import { MAX_PHOTOS_PER_REPORT } from "./upload-rules";

export * from "./planogram-format";

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

/** Pathnames de foto que estaban y ya no están (para borrarlos del almacenamiento). */
export function removedPathnames(before: (string | null)[], after: (string | null)[]): string[] {
  const keep = new Set(after.filter((p): p is string => !!p));
  return [...new Set(before.filter((p): p is string => !!p && !keep.has(p)))];
}
