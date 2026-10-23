"use server";

/** Vacaciones: reglas de la campaña y semanas con regla propia (Ajustes → Vacaciones). Solo el dueño. */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { formatStamp, fromDbDate, isDateStr, madridToday, toDbDate } from "@/lib/dates";
import { authorizeVacation } from "@/lib/vacation-server";
import { getVacationCampaign, getVacationWeeks } from "@/lib/vacation-queries";
import { MAX_SIGNATURE_LENGTH, checkVacations, countedDays, isSignature, mondaysBetween } from "@/lib/vacations";
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
  /** Primer día: se guarda desde el lunes de su semana. */
  date: dateSchema,
  /** Último día (opcional): todas las semanas seguidas hasta la de esta fecha. */
  to: dateSchema.nullish(),
  blocked: z.boolean(),
  reason: z.string().trim().max(80, "Motivo demasiado largo.").nullish(),
  maxOverride: max.nullish(),
});

const MAX_RULE_WEEKS = 30;

/** Bloquea (o pone otro máximo a) todas las semanas de `date` a `to`. Sin regla, vuelven a ser normales. */
export async function saveVacationWeek(input: z.input<typeof weekSchema>): Promise<ActionResult> {
  await requireOwner();
  const p = weekSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Datos no válidos.");
  const { date, to, blocked, reason, maxOverride } = p.data;
  const mondays = mondaysBetween(date, to ?? date);
  if (mondays.length > MAX_RULE_WEEKS) return fail(`Como mucho ${MAX_RULE_WEEKS} semanas de golpe.`);
  const data = { blocked, reason: blocked ? reason || null : null, maxOverride: blocked ? null : (maxOverride ?? null) };
  await db.$transaction(
    mondays.map((m) => {
      const key = toDbDate(m);
      return !blocked && data.maxOverride === null
        ? db.vacationWeek.deleteMany({ where: { weekStart: key } })
        : db.vacationWeek.upsert({ where: { weekStart: key }, create: { weekStart: key, ...data }, update: data });
    }),
  );
  revalidate();
  revalidatePath("/semana", "layout");
  revalidatePath("/vacaciones");
  return { ok: true };
}

/** Quita la regla de las semanas de `date` a `to`. */
export async function deleteVacationWeek(input: { date: string; to?: string | null }): Promise<ActionResult> {
  await requireOwner();
  const p = z.object({ date: dateSchema, to: dateSchema.nullish() }).safeParse(input);
  if (!p.success) return fail("Fecha no válida.");
  const mondays = mondaysBetween(p.data.date, p.data.to ?? p.data.date);
  if (mondays.length > MAX_RULE_WEEKS) return fail(`Como mucho ${MAX_RULE_WEEKS} semanas de golpe.`);
  await db.vacationWeek.deleteMany({ where: { weekStart: { in: mondays.map(toDbDate) } } });
  revalidate();
  revalidatePath("/semana", "layout");
  revalidatePath("/vacaciones");
  return { ok: true };
}

// ---- Empleado (/vacaciones): enviar sus fechas FIRMADAS ---------------------------------------------------------

const submitSchema = z.object({
  periods: z.array(z.object({ start: dateSchema, end: dateSchema })).max(20, "Demasiados periodos."),
  signature: z.string().max(MAX_SIGNATURE_LENGTH, "La firma es demasiado grande."),
});

/**
 * Cada cambio va firmado: sustituye los periodos del empleado por los enviados (los que no cambian conservan su
 * estado; los nuevos quedan «Enviado») y guarda la firma con una copia de las fechas.
 */
export async function submitVacations(input: z.input<typeof submitSchema>): Promise<ActionResult> {
  const employee = await authorizeVacation();
  const p = submitSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Datos no válidos.");
  if (!isSignature(p.data.signature)) return fail("Falta tu firma.");
  const campaign = await getVacationCampaign();
  if (!campaign) return fail("Todavía no se pueden pedir vacaciones.");
  if (!campaign.open || madridToday() > campaign.deadline) return fail("El plazo para elegir vacaciones está cerrado.");
  const weeks = await getVacationWeeks(campaign.year);
  const blocked = new Set(weeks.filter((w) => w.blocked).map((w) => w.weekStart));
  const ranges = [...p.data.periods].sort((a, b) => (a.start < b.start ? -1 : 1));
  const err = checkVacations(ranges, { year: campaign.year, workDays: campaign.workDays, blocked });
  if (err) return fail(err);

  const year = campaign.year;
  await db.$transaction(async (tx) => {
    const prev = await tx.vacationPeriod.findMany({ where: { employeeId: employee.id, year } });
    const key = (s: string, e: string) => `${s}|${e}`;
    const wanted = new Set(ranges.map((r) => key(r.start, r.end)));
    const kept = new Set<string>();
    for (const row of prev) {
      const k = key(fromDbDate(row.start), fromDbDate(row.end));
      if (wanted.has(k) && !kept.has(k)) kept.add(k);
      else await tx.vacationPeriod.delete({ where: { id: row.id } });
    }
    for (const r of ranges) {
      if (kept.has(key(r.start, r.end))) continue;
      await tx.vacationPeriod.create({ data: { employeeId: employee.id, year, start: toDbDate(r.start), end: toDbDate(r.end) } });
    }
    await tx.vacationSubmission.create({
      data: { employeeId: employee.id, year, periods: ranges, workDays: countedDays(ranges), signature: p.data.signature },
    });
  });
  revalidatePath("/vacaciones");
  revalidatePath("/ajustes", "layout");
  return { ok: true };
}

// ---- Encargado: ficha de vacaciones de una persona (vista general) ----------------------------------------------

export type VacationPersonDetail = {
  ok: true;
  periods: { start: string; end: string; status: string }[];
  signature: string | null;
  signedAt: string | null;
  submissions: number;
};

export async function getVacationPerson(input: { employeeId: string; year: number }): Promise<VacationPersonDetail | { ok: false; error: string }> {
  await requireOwner();
  const p = z.object({ employeeId: z.string().min(1).max(64), year: z.number().int() }).safeParse(input);
  if (!p.success) return fail("Datos no válidos.") as { ok: false; error: string };
  const { employeeId, year } = p.data;
  const [periods, last, submissions] = await Promise.all([
    db.vacationPeriod.findMany({ where: { employeeId, year }, orderBy: { start: "asc" } }),
    db.vacationSubmission.findFirst({ where: { employeeId, year }, orderBy: { signedAt: "desc" } }),
    db.vacationSubmission.count({ where: { employeeId, year } }),
  ]);
  return {
    ok: true,
    periods: periods.map((x) => ({ start: fromDbDate(x.start), end: fromDbDate(x.end), status: x.status })),
    signature: last?.signature ?? null,
    signedAt: last ? formatStamp(last.signedAt) : null,
    submissions,
  };
}
