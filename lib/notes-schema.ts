/** Validación (zod) de las notas. Los tipos y utilidades sin zod están en lib/notes.ts. */
import { z } from "zod";
import { isDateStr } from "./dates";
import { MAX_NOTE_TEXT, NOTE_TYPES } from "./notes";
import { photoInputSchema } from "./reports";
import { MAX_PHOTOS_PER_NOTE } from "./upload-rules";

const idSchema = z.string().min(1).max(64);
const optId = idSchema.nullish().transform((v) => v || null);

export const saveNoteSchema = z.object({
  /** Sin id = nota nueva. */
  id: idSchema.optional(),
  date: z.string().refine(isDateStr, "Fecha no válida."),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida.")
    .nullish()
    .or(z.literal(""))
    .transform((v) => v || null),
  type: z.enum(NOTE_TYPES),
  text: z.string().trim().min(1, "Escribe la nota.").max(MAX_NOTE_TEXT, `La nota no puede superar ${MAX_NOTE_TEXT} caracteres.`),
  employeeId: optId,
  /** Varias personas (la primera es la principal). Si viene, manda sobre `employeeId`. */
  employeeIds: z.array(z.string().min(1).max(64)).max(60, "Demasiadas personas.").optional(),
  departmentId: optId,
  sectionId: optId,
  /** Fotos nuevas (se añaden a las que ya tiene). */
  photos: z.array(photoInputSchema).max(MAX_PHOTOS_PER_NOTE, `Máximo ${MAX_PHOTOS_PER_NOTE} fotos por nota.`).default([]),
});

export type SaveNoteInput = z.input<typeof saveNoteSchema>;
