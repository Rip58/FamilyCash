"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isDateStr, toDbDate } from "@/lib/dates";
import { db } from "@/lib/db";

export type NoteActionResult = { ok: true } | { ok: false; error: string };

const addSchema = z.object({
  date: z.string().refine(isDateStr, "Fecha no válida."),
  employeeId: z.string().min(1).max(64).nullable(),
  text: z.string().trim().min(1, "Escribe la nota.").max(1000, "Nota demasiado larga."),
});

function revalidate() {
  revalidatePath("/informe", "layout");
}

/** Añade una nota a la noche (general o de un empleado). */
export async function addNightNote(input: z.input<typeof addSchema>): Promise<NoteActionResult> {
  const p = addSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos no válidos." };
  if (p.data.employeeId && !(await db.employee.findUnique({ where: { id: p.data.employeeId } }))) {
    return { ok: false, error: "Empleado no encontrado." };
  }
  await db.nightNote.create({ data: { date: toDbDate(p.data.date), employeeId: p.data.employeeId, text: p.data.text } });
  revalidate();
  return { ok: true };
}

export async function deleteNightNote(id: string): Promise<NoteActionResult> {
  const p = z.string().min(1).max(64).safeParse(id);
  if (!p.success) return { ok: false, error: "Datos no válidos." };
  await db.nightNote.deleteMany({ where: { id: p.data } });
  revalidate();
  return { ok: true };
}
