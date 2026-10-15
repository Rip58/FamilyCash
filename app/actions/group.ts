"use server";

/** «Grupo»: marcar que un departamento sin nadie lo hacen esa noche entre los compañeros (Hoy). */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isDateStr, toDbDate } from "@/lib/dates";
import { db } from "@/lib/db";

const schema = z.object({
  date: z.string().refine(isDateStr),
  departmentId: z.string().min(1).max(64),
  on: z.boolean(),
});

export async function setGroupCover(input: z.input<typeof schema>): Promise<{ ok: true } | { ok: false; error: string }> {
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: "Datos no válidos." };
  const { date, departmentId, on } = p.data;
  const key = { date_departmentId: { date: toDbDate(date), departmentId } };
  try {
    if (on) await db.groupCover.upsert({ where: key, create: { date: toDbDate(date), departmentId }, update: {} });
    else await db.groupCover.deleteMany({ where: { date: toDbDate(date), departmentId } });
  } catch {
    return { ok: false, error: "No se pudo guardar. Inténtalo de nuevo." };
  }
  revalidatePath("/hoy", "layout");
  revalidatePath("/semana", "layout");
  revalidatePath("/informe", "layout");
  return { ok: true };
}
