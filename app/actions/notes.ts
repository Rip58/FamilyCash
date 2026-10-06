"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isDateStr, toDbDate } from "@/lib/dates";
import { db } from "@/lib/db";

export type NoteActionResult = { ok: true } | { ok: false; error: string };

const addSchema = z.object({
  date: z.string().refine(isDateStr, "Fecha no válida."),
  employeeId: z.string().min(1).max(64).nullable(),
  departmentId: z.string().min(1).max(64).nullable(),
  kind: z.enum(["INFO", "TASK"]),
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
  if (p.data.departmentId && !(await db.department.findUnique({ where: { id: p.data.departmentId } }))) {
    return { ok: false, error: "Departamento no encontrado." };
  }
  const { date, ...rest } = p.data;
  await db.nightNote.create({ data: { date: toDbDate(date), ...rest } });
  revalidate();
  return { ok: true };
}

const updateSchema = addSchema.omit({ date: true }).extend({ id: z.string().min(1).max(64) });

/** Edita una nota de la noche (texto, tipo, empleado y departamento). */
export async function updateNightNote(input: z.input<typeof updateSchema>): Promise<NoteActionResult> {
  const p = updateSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos no válidos." };
  if (p.data.employeeId && !(await db.employee.findUnique({ where: { id: p.data.employeeId } }))) {
    return { ok: false, error: "Empleado no encontrado." };
  }
  if (p.data.departmentId && !(await db.department.findUnique({ where: { id: p.data.departmentId } }))) {
    return { ok: false, error: "Departamento no encontrado." };
  }
  const { id, kind, ...rest } = p.data;
  const prev = await db.nightNote.findUnique({ where: { id } });
  if (!prev) return { ok: false, error: "La nota ya no existe." };
  // Si deja de ser tarea, ya no tiene «hecha».
  await db.nightNote.update({ where: { id }, data: { ...rest, kind, ...(kind === "INFO" ? { doneAt: null } : {}) } });
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

/** Marca una tarea como hecha o pendiente. */
export async function setNoteDone(input: { id: string; done: boolean }): Promise<NoteActionResult> {
  const p = z.object({ id: z.string().min(1).max(64), done: z.boolean() }).safeParse(input);
  if (!p.success) return { ok: false, error: "Datos no válidos." };
  await db.nightNote.updateMany({ where: { id: p.data.id, kind: "TASK" }, data: { doneAt: p.data.done ? new Date() : null } });
  revalidate();
  return { ok: true };
}
