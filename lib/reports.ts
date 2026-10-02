/**
 * Avisos con foto: validación (zod). Los tipos y utilidades sin zod están en lib/report-format.ts
 * (los componentes de cliente importan de allí); se reexportan aquí por comodidad en el servidor.
 */
import { z } from "zod";
import { isDateStr } from "./dates";
import { MAX_REPORT_TEXT } from "./report-format";
import { MAX_PHOTOS_PER_REPORT, isPhotoUrlFor } from "./upload-rules";

export * from "./report-format";

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

