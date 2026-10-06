"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { setAbsenceNotified } from "@/lib/absence-log";
import { isDateStr, toDbDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { getStatusTypes } from "@/lib/queries";

export type AbsenceActionResult = { ok: true } | { ok: false; error: string };

const keySchema = z.object({ employeeId: z.string().min(1).max(64), date: z.string().refine(isDateStr, "Fecha no válida.") });
const noticeSchema = keySchema.extend({
  notified: z.boolean().nullable(),
  /** Estado con el que se marca la falta (para el registro si aún no existe). */
  statusTypeId: z.string().min(1).max(64).nullish(),
});

/** Falta: ¿avisó? (true / false / null = sin indicar). Queda en el registro de faltas. */
export async function setAbsenceNotice(input: z.input<typeof noticeSchema>): Promise<AbsenceActionResult> {
  const p = noticeSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Datos no válidos." };
  const statusTypes = await getStatusTypes();
  const label = statusTypes.find((s) => s.id === p.data.statusTypeId)?.label ?? statusTypes.find((s) => s.code === "ABSENT")?.label ?? "Falta";
  await setAbsenceNotified(db, { employeeId: p.data.employeeId, date: p.data.date, notified: p.data.notified, statusLabel: label });
  revalidatePath("/informe", "layout");
  return { ok: true };
}

/** Lo apuntado de una falta (para mostrarlo al resolverla). */
export async function getAbsenceNotice(employeeId: string, date: string): Promise<{ notified: boolean | null } | null> {
  const p = keySchema.safeParse({ employeeId, date });
  if (!p.success) return null;
  const row = await db.absence.findUnique({
    where: { employeeId_date: { employeeId: p.data.employeeId, date: toDbDate(p.data.date) } },
    select: { notified: true },
  });
  return row ? { notified: row.notified } : null;
}
