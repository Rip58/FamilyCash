"use server";

/** Recordatorios: crear/editar/borrar (Informe → Recordatorios) y avisos al abrir la app. */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isDateStr, madridParts, toDbDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { listReminders } from "@/lib/reminder-queries";
import { type ReminderView, dueOccurrence, lastOccurrence } from "@/lib/reminders";
import { requireOwner } from "@/lib/session";

export type ReminderResult = { ok: true } | { ok: false; error: string };

const idSchema = z.string().min(1).max(64);
const saveSchema = z
  .object({
    id: idSchema.optional(),
    text: z.string().trim().min(1, "Escribe el recordatorio.").max(300, "Máximo 300 caracteres."),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    date: z.string().refine(isDateStr, "Fecha no válida.").nullable(),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida."),
    active: z.boolean().default(true),
  })
  .refine((v) => v.weekdays.length > 0 || v.date, { message: "Elige los días de la semana o una fecha." });

function nowMadrid(now = new Date()) {
  const { date, hour, minute } = madridParts(now);
  return { date, time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` };
}

function revalidate() {
  revalidatePath("/informe", "layout");
}

export async function saveReminder(input: z.input<typeof saveSchema>): Promise<ReminderResult> {
  await requireOwner();
  const p = saveSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos no válidos." };
  const { id, weekdays, date, ...rest } = p.data;
  const days = [...new Set(weekdays)].sort((a, b) => a - b);
  // Con días de la semana no hay fecha suelta.
  const oneDate = days.length > 0 || !date ? null : date;
  // Avisa a partir del próximo día que toque (no de uno que ya pasó antes de crearlo o cambiarlo).
  const { date: today, time } = nowMadrid();
  const data = {
    ...rest,
    weekdays: days,
    date: oneDate ? toDbDate(oneDate) : null,
    lastDone: days.length > 0 ? lastOccurrence({ weekdays: days, date: null, time: rest.time }, today, time) : null,
    snoozedUntil: null,
  };
  if (id) {
    const r = await db.reminder.updateMany({ where: { id }, data });
    if (r.count === 0) return { ok: false, error: "El recordatorio ya no existe." };
  } else {
    await db.reminder.create({ data });
  }
  revalidate();
  return { ok: true };
}

export async function deleteReminder(id: string): Promise<ReminderResult> {
  await requireOwner();
  const p = idSchema.safeParse(id);
  if (!p.success) return { ok: false, error: "Datos no válidos." };
  await db.reminder.deleteMany({ where: { id: p.data } });
  revalidate();
  return { ok: true };
}

/** Avisos que tocan ahora (al abrir la app, al volver a ella y cada pocos minutos). */
export async function getDueReminders(): Promise<{ reminder: ReminderView; occurrence: string }[]> {
  await requireOwner();
  const now = new Date();
  const { date, time } = nowMadrid(now);
  const list = await listReminders();
  return list.flatMap((reminder) => {
    const occurrence = dueOccurrence(reminder, date, time, now.toISOString());
    return occurrence ? [{ reminder, occurrence }] : [];
  });
}

/** «Hecho»: no vuelve a avisar hasta el próximo día que toque. */
export async function markReminderDone(input: { id: string; occurrence: string }): Promise<ReminderResult> {
  await requireOwner();
  const p = z.object({ id: idSchema, occurrence: z.string().refine(isDateStr) }).safeParse(input);
  if (!p.success) return { ok: false, error: "Datos no válidos." };
  await db.reminder.updateMany({ where: { id: p.data.id }, data: { lastDone: p.data.occurrence, snoozedUntil: null } });
  revalidate();
  return { ok: true };
}

/** «Recordar más tarde»: vuelve a salir dentro de `minutes`. */
export async function snoozeReminder(input: { id: string; minutes: number }): Promise<ReminderResult> {
  await requireOwner();
  const p = z.object({ id: idSchema, minutes: z.number().int().min(5).max(24 * 60) }).safeParse(input);
  if (!p.success) return { ok: false, error: "Datos no válidos." };
  await db.reminder.updateMany({ where: { id: p.data.id }, data: { snoozedUntil: new Date(Date.now() + p.data.minutes * 60_000) } });
  return { ok: true };
}
