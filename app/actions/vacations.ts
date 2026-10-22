"use server";

/** Vacaciones: reglas de la campaña y semanas con regla propia (Ajustes → Vacaciones). Solo el dueño. */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isDateStr, toDbDate, weekStart } from "@/lib/dates";
import { requireOwner } from "@/lib/session";

type ActionResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): ActionResult => ({ ok: false, error });

const dateSchema = z.string().refine(isDateStr, "Fecha no válida.");
const max = z.number().int().min(0, "El máximo no puede ser negativo.").max(30);

const campaignSchema = z.object({
  year: z.number().int().min(2026).max(2100),
  workDays: z.number().int().min(1, "Al menos 1 día.").max(60),
  deadline: dateSchema,
  open: z.boolean(),
  defaultMax: max,
  departmentMax: z.record(z.string().min(1).max(64), max),
});

function revalidate() {
  revalidatePath("/ajustes", "layout");
}

export async function saveVacationCampaign(input: z.input<typeof campaignSchema>): Promise<ActionResult> {
  await requireOwner();
  const p = campaignSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Datos no válidos.");
  const { year, deadline, ...rest } = p.data;
  const data = { ...rest, deadline: toDbDate(deadline) };
  await db.vacationCampaign.upsert({ where: { year }, create: { year, ...data }, update: data });
  revalidate();
  return { ok: true };
}

const weekSchema = z.object({
  /** Cualquier día de la semana: se guarda su lunes. */
  date: dateSchema,
  blocked: z.boolean(),
  reason: z.string().trim().max(80, "Motivo demasiado largo.").nullish(),
  maxOverride: max.nullish(),
});

export async function saveVacationWeek(input: z.input<typeof weekSchema>): Promise<ActionResult> {
  await requireOwner();
  const p = weekSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Datos no válidos.");
  const { date, blocked, reason, maxOverride } = p.data;
  const key = toDbDate(weekStart(date));
  const data = { blocked, reason: reason || null, maxOverride: maxOverride ?? null };
  // Sin bloqueo ni máximo propio, la semana vuelve a ser normal: no hace falta guardarla.
  if (!blocked && data.maxOverride === null) await db.vacationWeek.deleteMany({ where: { weekStart: key } });
  else await db.vacationWeek.upsert({ where: { weekStart: key }, create: { weekStart: key, ...data }, update: data });
  revalidate();
  return { ok: true };
}

export async function deleteVacationWeek(input: { date: string }): Promise<ActionResult> {
  await requireOwner();
  const p = z.object({ date: dateSchema }).safeParse(input);
  if (!p.success) return fail("Fecha no válida.");
  await db.vacationWeek.deleteMany({ where: { weekStart: toDbDate(weekStart(p.data.date)) } });
  revalidate();
  return { ok: true };
}
