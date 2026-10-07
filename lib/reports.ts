/** Validación (zod) de las fotos subidas. Los tipos sin zod están en lib/report-format.ts. */
import { z } from "zod";
import { isPhotoUrlFor } from "./upload-rules";

export * from "./report-format";

export const photoInputSchema = z
  .object({
    url: z.string().min(1).max(600),
    pathname: z.string().min(1).max(200),
    width: z.number().int().min(1).max(20000),
    height: z.number().int().min(1).max(20000),
    size: z.number().int().min(0).max(50 * 1024 * 1024).optional().default(0),
  })
  .refine((p) => isPhotoUrlFor(p.url, p.pathname), "Foto no válida.");
