"use server";

/** Temas de reunión (Protocolos → Reuniones): apuntar, marcar tratado (con valoración) y borrar. */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isDateStr, madridToday, toDbDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { MAX_MEETING_TEXT } from "@/lib/meetings";
import { requireOwner } from "@/lib/session";

export type MeetingResult = { ok: true } | { ok: false; error: string };

const idSchema = z.string().min(1).max(64);
const optId = idSchema.nullable();
const saveSchema = z.object({
  id: idSchema.optional(),
  text: z.string().trim().min(1, "Escribe el tema.").max(MAX_MEETING_TEXT, `Máximo ${MAX_MEETING_TEXT} caracteres.`),
  employeeId: optId,
  departmentId: optId,
  doneOn: z.string().refine(isDateStr, "Fecha no válida.").nullable(),
  outcome: z.string().trim().max(MAX_MEETING_TEXT, `Máximo ${MAX_MEETING_TEXT} caracteres.`).nullable(),
});

function revalidate() {
  revalidatePath("/protocolos/reuniones");
  revalidatePath("/informe/empleado");
}

export async function saveMeetingTopic(input: z.input<typeof saveSchema>): Promise<MeetingResult> {
  await requireOwner();
  const p = saveSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos no válidos." };
  const { id, doneOn, outcome, ...rest } = p.data;
  const data = { ...rest, doneOn: doneOn ? toDbDate(doneOn) : null, outcome: outcome || null };
  if (id) {
    const r = await db.meetingTopic.updateMany({ where: { id }, data });
    if (r.count === 0) return { ok: false, error: "El tema ya no existe." };
  } else {
    await db.meetingTopic.create({ data });
  }
  revalidate();
  return { ok: true };
}

/** Casilla: tratado hoy / vuelve a pendiente. */
export async function setMeetingTopicDone(input: { id: string; done: boolean }): Promise<MeetingResult> {
  await requireOwner();
  const p = z.object({ id: idSchema, done: z.boolean() }).safeParse(input);
  if (!p.success) return { ok: false, error: "Datos no válidos." };
  await db.meetingTopic.updateMany({
    where: { id: p.data.id },
    data: { doneOn: p.data.done ? toDbDate(madridToday()) : null },
  });
  revalidate();
  return { ok: true };
}

export async function deleteMeetingTopic(id: string): Promise<MeetingResult> {
  await requireOwner();
  const p = idSchema.safeParse(id);
  if (!p.success) return { ok: false, error: "Datos no válidos." };
  await db.meetingTopic.deleteMany({ where: { id: p.data } });
  revalidate();
  return { ok: true };
}
