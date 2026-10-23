"use server";

/** Vacaciones: reglas de la campaña y semanas con regla propia (Ajustes → Vacaciones). Solo el dueño. */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { formatStamp, fromDbDate, isDateStr, madridToday, toDbDate } from "@/lib/dates";
import { authorizeVacation } from "@/lib/vacation-server";
import { getVacationCampaign, getVacationWeeks } from "@/lib/vacation-queries";
import { MAX_MESSAGE_TEXT, MAX_SIGNATURE_LENGTH, VACATION_YEAR, checkVacations, countedDays, isSignature, mondaysBetween, planningDaysFor } from "@/lib/vacations";
import { getEmployees, getEntriesBetween, getStatusTypes } from "@/lib/queries";
import { writePlanningDays } from "@/lib/planning-write";
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
  const applied = await db.vacationPeriod.findMany({ where: { employeeId: employee.id, year, status: "APPLIED" } });
  const kept = new Set(ranges.map((r) => `${r.start}|${r.end}`));
  if (applied.some((a) => !kept.has(`${fromDbDate(a.start)}|${fromDbDate(a.end)}`))) {
    return fail("Hay vacaciones que ya están en el planning: para cambiarlas habla con tu encargado.");
  }
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
  periods: { id: string; start: string; end: string; status: string }[];
  messages: { id: string; fromOwner: boolean; text: string; at: string }[];
  signature: string | null;
  signedAt: string | null;
  submissions: number;
};

export async function getVacationPerson(input: { employeeId: string; year: number }): Promise<VacationPersonDetail | { ok: false; error: string }> {
  await requireOwner();
  const p = z.object({ employeeId: z.string().min(1).max(64), year: z.number().int() }).safeParse(input);
  if (!p.success) return fail("Datos no válidos.") as { ok: false; error: string };
  const { employeeId, year } = p.data;
  const [periods, last, submissions, messages] = await Promise.all([
    db.vacationPeriod.findMany({ where: { employeeId, year }, orderBy: { start: "asc" } }),
    db.vacationSubmission.findFirst({ where: { employeeId, year }, orderBy: { signedAt: "desc" } }),
    db.vacationSubmission.count({ where: { employeeId, year } }),
    db.vacationMessage.findMany({ where: { employeeId, year }, orderBy: { createdAt: "asc" } }),
  ]);
  // Abrir su ficha de vacaciones = has leído lo que te escribió.
  if (messages.some((m) => !m.fromOwner && !m.seen)) {
    await db.vacationMessage.updateMany({ where: { employeeId, year, fromOwner: false, seen: false }, data: { seen: true } });
  }
  return {
    ok: true,
    periods: periods.map((x) => ({ id: x.id, start: fromDbDate(x.start), end: fromDbDate(x.end), status: x.status })),
    messages: messages.map((m) => ({ id: m.id, fromOwner: m.fromOwner, text: m.text, at: formatStamp(m.createdAt) })),
    signature: last?.signature ?? null,
    signedAt: last ? formatStamp(last.signedAt) : null,
    submissions,
  };
}

// ---- Encargado: estado de cada periodo, chat y pasar a Semana --------------------------------------------------

const statusSchema = z.object({
  periodIds: z.array(z.string().min(1).max(64)).min(1).max(500),
  status: z.enum(["SENT", "REVIEW", "OK"]),
});

/** Correcto / a revisar / enviado. Lo que ya está en el planning no cambia. */
export async function setVacationStatus(input: z.input<typeof statusSchema>): Promise<ActionResult & { changed?: number }> {
  await requireOwner();
  const p = statusSchema.safeParse(input);
  if (!p.success) return fail("Datos no válidos.");
  const r = await db.vacationPeriod.updateMany({
    where: { id: { in: p.data.periodIds }, status: { not: "APPLIED" } },
    data: { status: p.data.status },
  });
  revalidatePath("/semana", "layout");
  revalidatePath("/vacaciones");
  return { ok: true, changed: r.count };
}

const messageSchema = z.object({
  employeeId: z.string().min(1).max(64),
  year: z.number().int(),
  text: z.string().trim().min(1, "Escribe el mensaje.").max(MAX_MESSAGE_TEXT, "Mensaje demasiado largo."),
  /** Periodos que pasan a «A revisar» con este mensaje (pedir cambio). */
  review: z.array(z.string().min(1).max(64)).max(50).optional(),
});

export async function sendVacationMessage(input: z.input<typeof messageSchema>): Promise<ActionResult> {
  await requireOwner();
  const p = messageSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Datos no válidos.");
  const { employeeId, year, text, review } = p.data;
  await db.$transaction([
    db.vacationMessage.create({ data: { employeeId, year, fromOwner: true, text } }),
    ...(review?.length
      ? [db.vacationPeriod.updateMany({ where: { id: { in: review }, employeeId, status: { not: "APPLIED" } }, data: { status: "REVIEW" } })]
      : []),
  ]);
  revalidatePath("/semana", "layout");
  revalidatePath("/vacaciones");
  return { ok: true };
}

/**
 * Pasa a Semana los periodos CORRECTOS (de una persona o de todos): los días que descuentan quedan «Vacaciones» y
 * su fiesta «Fiesta» en el planning, con los registros de siempre, y el periodo queda «En el planning».
 */
export async function applyVacationsToPlanning(input: { year: number; employeeId?: string | null }): Promise<ActionResult & { changed?: number }> {
  await requireOwner();
  const p = z.object({ year: z.number().int(), employeeId: z.string().min(1).max(64).nullish() }).safeParse(input);
  if (!p.success) return fail("Datos no válidos.");
  const periods = await db.vacationPeriod.findMany({
    where: { year: p.data.year, status: "OK", ...(p.data.employeeId ? { employeeId: p.data.employeeId } : {}) },
    orderBy: { start: "asc" },
  });
  if (periods.length === 0) return fail("No hay vacaciones marcadas como correctas para pasar.");
  const [employees, statusTypes] = await Promise.all([getEmployees(), getStatusTypes()]);
  const vacation = statusTypes.find((s) => s.code === "VACATION");
  const off = statusTypes.find((s) => s.code === "OFF");
  if (!vacation || !off) return fail("Faltan los estados «Vacaciones» o «Fiesta» en Ajustes → Estados.");
  const ranges = periods.map((x) => ({ ...x, range: { start: fromDbDate(x.start), end: fromDbDate(x.end) } }));
  const all = ranges.flatMap((x) => planningDaysFor(x.range).map((d) => d.date)).sort();
  const entries = await getEntriesBetween(all[0]!, all.at(-1)!);
  await db.$transaction(
    async (tx) => {
      for (const x of ranges) {
        const employee = employees.find((e) => e.id === x.employeeId);
        if (!employee) continue;
        const days = planningDaysFor(x.range).map((d) => ({
          date: d.date,
          statusTypeId: d.code === "VACATION" ? vacation.id : off.id,
          reason: null,
        }));
        await writePlanningDays(tx, employee, days, entries, statusTypes);
        await tx.vacationPeriod.update({ where: { id: x.id }, data: { status: "APPLIED" } });
      }
    },
    { timeout: 60_000 },
  );
  revalidatePath("/semana", "layout");
  revalidatePath("/hoy", "layout");
  revalidatePath("/informe", "layout");
  revalidatePath("/vacaciones");
  return { ok: true, changed: periods.length };
}

// ---- Empleado: contestar y dar por leído ---------------------------------------------------------------------

export async function replyVacationMessage(input: { text: string }): Promise<ActionResult> {
  const employee = await authorizeVacation();
  const p = z.object({ text: z.string().trim().min(1, "Escribe el mensaje.").max(MAX_MESSAGE_TEXT, "Mensaje demasiado largo.") }).safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Datos no válidos.");
  await db.vacationMessage.create({ data: { employeeId: employee.id, year: VACATION_YEAR, fromOwner: false, text: p.data.text } });
  revalidatePath("/vacaciones");
  revalidatePath("/semana", "layout");
  return { ok: true };
}

export async function markVacationMessagesSeen(): Promise<ActionResult> {
  const employee = await authorizeVacation();
  await db.vacationMessage.updateMany({ where: { employeeId: employee.id, year: VACATION_YEAR, fromOwner: true, seen: false }, data: { seen: true } });
  return { ok: true };
}
