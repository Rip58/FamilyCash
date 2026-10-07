"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { type DateStr, addDays, formatDayLong, isDateStr, toDbDate, weekDays, weekStart as weekStartOf } from "@/lib/dates";
import { REF_TAG, getEmployees, getEntriesBetween, getStatusTypes } from "@/lib/queries";
import { type AbsenceResolution } from "@/lib/absence";
import { syncAbsence } from "@/lib/absence-log";
import { type DayEntryLite, type EmployeeLite, type StatusTypeLite, getEffectiveDay, isDayOffStatus } from "@/lib/schedule";
import { MAX_RANGE_DAYS, planCopyWeek, planRepeatWeek, planSetCell, rangeDates, remainingMonthWeeks } from "@/lib/week";

export type WeekActionResult = { ok: true; changed?: number } | { ok: false; error: string };

const dateSchema = z.string().refine(isDateStr, "Fecha inválida");

const setCellSchema = z.object({
  employeeId: z.string().min(1),
  date: dateSchema,
  statusTypeId: z.string().min(1),
  reason: z.string().trim().max(200).nullish(),
});
const weekSchema = z.object({ weekStart: dateSchema });
const rangeSchema = setCellSchema.extend({ days: z.number().int().min(1).max(MAX_RANGE_DAYS) });

function revalidate() {
  revalidatePath("/semana", "layout");
  revalidatePath("/hoy", "layout");
  revalidatePath("/informe", "layout");
}

/**
 * Registro de faltas tras cambiar el planning de un día: si pasa a ser falta se apunta; si deja de serlo
 * (p. ej. se cambia a fiesta) se conserva y se anota cómo se resolvió.
 */
async function logPlanningChange(
  tx: Parameters<typeof syncAbsence>[0],
  employee: EmployeeLite,
  date: DateStr,
  existing: DayEntryLite | null,
  next: { statusTypeId: string; reason: string | null; clearActual?: boolean },
  statusTypes: StatusTypeLite[],
  resolution?: { kind: AbsenceResolution; note: string },
) {
  const blank: DayEntryLite = {
    employeeId: employee.id, date, statusTypeId: next.statusTypeId, departmentId: null, reason: null,
    arrivedAt: null, leftAt: null, timeReason: null, segments: [],
  };
  const after: DayEntryLite = {
    ...(existing ?? blank),
    statusTypeId: next.statusTypeId,
    reason: next.reason,
    actualStatusTypeId: next.clearActual ? null : (existing?.actualStatusTypeId ?? null),
  };
  await syncAbsence(tx, {
    employeeId: employee.id,
    date,
    before: getEffectiveDay(employee, date, existing, statusTypes),
    after: getEffectiveDay(employee, date, after, statusTypes),
    source: "semana",
    resolution,
  });
}

const fail = (e: unknown): WeekActionResult => {
  console.error(e);
  return { ok: false, error: "No se pudo guardar. Inténtalo de nuevo." };
};

/** Cambia el estado de un empleado en un día (borra la entrada si coincide con el patrón). */
export async function setCellStatus(
  employeeId: string,
  date: string,
  statusTypeId: string,
  reason?: string | null,
): Promise<WeekActionResult> {
  const parsed = setCellSchema.safeParse({ employeeId, date, statusTypeId, reason });
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const input = parsed.data;
  try {
    const [employees, statusTypes, entries] = await Promise.all([
      getEmployees(),
      getStatusTypes(),
      getEntriesBetween(input.date, input.date),
    ]);
    const employee = employees.find((e) => e.id === input.employeeId);
    if (!employee) return { ok: false, error: "Empleado no encontrado." };
    if (!statusTypes.some((s) => s.id === input.statusTypeId)) {
      return { ok: false, error: "Estado no encontrado." };
    }
    const existing = entries.find((e) => e.employeeId === employee.id) ?? null;
    const plan = planSetCell({
      employee,
      date: input.date,
      statusTypeId: input.statusTypeId,
      reason: input.reason ?? null,
      existing,
      statusTypes,
    });
    const where = { employeeId_date: { employeeId: employee.id, date: toDbDate(input.date) } };
    if (plan.kind === "delete") {
      await db.dayEntry.deleteMany({ where: { employeeId: employee.id, date: toDbDate(input.date) } });
    } else {
      await db.dayEntry.upsert({
        where,
        update: {
          statusTypeId: plan.statusTypeId,
          reason: plan.reason,
          // Si cambia el planning, la validación de Hoy (si era "como el planning") ya no vale.
          ...(existing && existing.statusTypeId !== plan.statusTypeId && !existing.actualStatusTypeId ? { present: null } : {}),
        },
        create: {
          employeeId: employee.id,
          date: toDbDate(input.date),
          statusTypeId: plan.statusTypeId,
          reason: plan.reason,
        },
      });
    }
    await logPlanningChange(db, employee, input.date, existing, { statusTypeId: input.statusTypeId, reason: input.reason ?? null }, statusTypes);
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Vacaciones / baja de varios días seguidos: pone el mismo estado (y motivo) desde `date` durante `days` días,
 * aunque pase a la semana siguiente. Mismas reglas que una casilla (`planSetCell`), en una sola transacción.
 */
export async function setCellStatusRange(
  employeeId: string,
  date: string,
  days: number,
  statusTypeId: string,
  reason?: string | null,
): Promise<WeekActionResult> {
  const parsed = rangeSchema.safeParse({ employeeId, date, days, statusTypeId, reason });
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const input = parsed.data;
  const dates = rangeDates(input.date, input.days);
  try {
    const [employees, statusTypes, entries] = await Promise.all([
      getEmployees(),
      getStatusTypes(),
      getEntriesBetween(dates[0]!, dates[dates.length - 1]!),
    ]);
    const employee = employees.find((e) => e.id === input.employeeId);
    if (!employee) return { ok: false, error: "Empleado no encontrado." };
    if (!statusTypes.some((s) => s.id === input.statusTypeId)) return { ok: false, error: "Estado no encontrado." };
    await db.$transaction(async (tx) => {
      for (const d of dates) {
        const existing = entries.find((e) => e.employeeId === employee.id && e.date === d) ?? null;
        const plan = planSetCell({ employee, date: d, statusTypeId: input.statusTypeId, reason: input.reason ?? null, existing, statusTypes });
        if (plan.kind === "delete") {
          await tx.dayEntry.deleteMany({ where: { employeeId: employee.id, date: toDbDate(d) } });
          continue;
        }
        await tx.dayEntry.upsert({
          where: { employeeId_date: { employeeId: employee.id, date: toDbDate(d) } },
          update: {
            statusTypeId: plan.statusTypeId,
            reason: plan.reason,
            ...(existing && existing.statusTypeId !== plan.statusTypeId && !existing.actualStatusTypeId ? { present: null } : {}),
          },
          create: { employeeId: employee.id, date: toDbDate(d), statusTypeId: plan.statusTypeId, reason: plan.reason },
        });
      }
      for (const d of dates) {
        const existing = entries.find((e) => e.employeeId === employee.id && e.date === d) ?? null;
        await logPlanningChange(tx, employee, d, existing, { statusTypeId: input.statusTypeId, reason: input.reason ?? null }, statusTypes);
      }
    });
    revalidate();
    return { ok: true, changed: dates.length };
  } catch (e) {
    return fail(e);
  }
}

// ---- Resolver una falta ------------------------------------------------------------------------------

const absenceSchema = z.object({ employeeId: z.string().min(1), date: dateSchema });

/** Días de fiesta (planning) de esa semana y la siguiente con los que se puede cambiar la falta. */
export async function absenceSwapOptions(employeeId: string, date: string): Promise<{ date: DateStr; label: string }[]> {
  const p = absenceSchema.safeParse({ employeeId, date });
  if (!p.success) return [];
  const from = weekStartOf(p.data.date);
  const to = addDays(from, 13);
  const [employees, statusTypes, entries] = await Promise.all([getEmployees(), getStatusTypes(), getEntriesBetween(from, to)]);
  const employee = employees.find((e) => e.id === p.data.employeeId);
  if (!employee) return [];
  const out: { date: DateStr; label: string }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (d === p.data.date) continue;
    const eff = getEffectiveDay(employee, d, entries.find((e) => e.employeeId === employee.id && e.date === d), statusTypes);
    if (isDayOffStatus(eff.planned ?? eff.status)) out.push({ date: d, label: formatDayLong(d) });
  }
  return out;
}

const resolveSchema = absenceSchema.extend({ mode: z.enum(["swap", "off"]), swapDate: dateSchema.nullish() });

/**
 * Cuando vuelve el empleado tras una falta:
 * - "swap": la falta pasa a ser su fiesta y el día de fiesta elegido (`swapDate`) pasa a trabajar.
 * - "off": la falta pasa a fiesta y conserva su fiesta (dos días de fiesta).
 * En los dos casos se quita lo validado en Hoy para ese día (ya no «no cuadra»). Cambia el planning.
 */
export async function resolveAbsence(input: z.input<typeof resolveSchema>): Promise<WeekActionResult> {
  const p = resolveSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Datos no válidos." };
  const { employeeId, date, mode } = p.data;
  const swapDate = mode === "swap" ? p.data.swapDate : null;
  if (mode === "swap" && (!swapDate || swapDate === date)) return { ok: false, error: "Elige el día de fiesta que cambia." };
  try {
    const dates = [date, ...(swapDate ? [swapDate] : [])].sort();
    const [employees, statusTypes, entries] = await Promise.all([
      getEmployees(),
      getStatusTypes(),
      getEntriesBetween(dates[0]!, dates[dates.length - 1]!),
    ]);
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) return { ok: false, error: "Empleado no encontrado." };
    const off = statusTypes.find((s) => s.code === "OFF");
    const work = statusTypes.find((s) => s.code === "WORK");
    if (!off || !work) return { ok: false, error: "Faltan los estados Fiesta o Trabaja." };
    const entryOf = (d: DateStr) => entries.find((e) => e.employeeId === employee.id && e.date === d) ?? null;
    if (swapDate) {
      const eff = getEffectiveDay(employee, swapDate, entryOf(swapDate), statusTypes);
      if (!isDayOffStatus(eff.planned ?? eff.status)) return { ok: false, error: "Ese día no es de fiesta." };
    }
    const writes: { date: DateStr; statusTypeId: string }[] = [
      { date, statusTypeId: off.id },
      ...(swapDate ? [{ date: swapDate, statusTypeId: work.id }] : []),
    ];
    const swapNote = swapDate ? `cambiada por su fiesta del ${formatDayLong(swapDate).toLowerCase()}` : "hace 2 días de fiesta";
    await db.$transaction(async (tx) => {
      await logPlanningChange(tx, employee, date, entryOf(date), { statusTypeId: off.id, reason: entryOf(date)?.reason ?? null, clearActual: true }, statusTypes, {
        kind: mode === "swap" ? "SWAP" : "OFF",
        note: swapNote,
      });
      for (const w of writes) {
        const prev = entryOf(w.date);
        const existing = prev ? { ...prev, actualStatusTypeId: null } : null;
        const plan = planSetCell({ employee, date: w.date, statusTypeId: w.statusTypeId, reason: prev?.reason ?? null, existing, statusTypes });
        const where = { employeeId_date: { employeeId: employee.id, date: toDbDate(w.date) } };
        if (plan.kind === "delete") {
          await tx.dayEntry.deleteMany({ where: { employeeId: employee.id, date: toDbDate(w.date) } });
        } else {
          await tx.dayEntry.upsert({
            where,
            update: { statusTypeId: plan.statusTypeId, reason: plan.reason, actualStatusTypeId: null },
            create: { employeeId: employee.id, date: toDbDate(w.date), statusTypeId: plan.statusTypeId, reason: plan.reason },
          });
        }
      }
    });
    revalidate();
    return { ok: true, changed: writes.length };
  } catch (e) {
    return fail(e);
  }
}

/** Copia estado/departamento/motivo de la semana anterior sobre la indicada. */
export async function copyPreviousWeek(weekStart: string): Promise<WeekActionResult> {
  const parsed = weekSchema.safeParse({ weekStart });
  if (!parsed.success) return { ok: false, error: "Fecha no válida." };
  const start = weekStartOf(parsed.data.weekStart);
  const days = weekDays(start);
  const prevStart = addDays(start, -7);
  try {
    const [employees, statusTypes, prevEntries, curEntries] = await Promise.all([
      getEmployees(),
      getStatusTypes(),
      getEntriesBetween(prevStart, addDays(start, -1)),
      getEntriesBetween(days[0]!, days[6]!),
    ]);
    const ops = planCopyWeek({ weekStart: start, employees, statusTypes, prevEntries, curEntries });
    await db.$transaction(
      ops.map((op) =>
        op.kind === "delete"
          ? db.dayEntry.deleteMany({ where: { employeeId: op.employeeId, date: toDbDate(op.date) } })
          : db.dayEntry.upsert({
              where: { employeeId_date: { employeeId: op.employeeId, date: toDbDate(op.date) } },
              update: { statusTypeId: op.statusTypeId, departmentId: op.departmentId, reason: op.reason },
              create: {
                employeeId: op.employeeId,
                date: toDbDate(op.date),
                statusTypeId: op.statusTypeId,
                departmentId: op.departmentId,
                reason: op.reason,
              },
            }),
      ),
    );
    revalidate();
    return { ok: true, changed: ops.length };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Repite el planning de esta semana en las semanas completas que quedan del mes
 * (sin repetir vacaciones/bajas puntuales y respetando las que ya hay en destino).
 */
export async function repeatWeekToMonthEnd(weekStart: string): Promise<WeekActionResult & { weeks?: number }> {
  const parsed = weekSchema.safeParse({ weekStart });
  if (!parsed.success) return { ok: false, error: "Fecha no válida." };
  const start = weekStartOf(parsed.data.weekStart);
  const targets = remainingMonthWeeks(start);
  if (targets.length === 0) return { ok: false, error: "Es la última semana del mes: no quedan semanas que rellenar." };
  try {
    const [employees, statusTypes, sourceEntries, targetEntries] = await Promise.all([
      getEmployees(),
      getStatusTypes(),
      getEntriesBetween(start, addDays(start, 6)),
      getEntriesBetween(targets[0]!, addDays(targets[targets.length - 1]!, 6)),
    ]);
    const ops = planRepeatWeek({ sourceStart: start, targets, employees, statusTypes, sourceEntries, targetEntries });
    await db.$transaction(
      ops.map((op) =>
        op.kind === "delete"
          ? db.dayEntry.deleteMany({ where: { employeeId: op.employeeId, date: toDbDate(op.date) } })
          : db.dayEntry.upsert({
              where: { employeeId_date: { employeeId: op.employeeId, date: toDbDate(op.date) } },
              update: { statusTypeId: op.statusTypeId, departmentId: op.departmentId, reason: op.reason },
              create: {
                employeeId: op.employeeId,
                date: toDbDate(op.date),
                statusTypeId: op.statusTypeId,
                departmentId: op.departmentId,
                reason: op.reason,
              },
            }),
      ),
      { timeout: 60_000 },
    );
    revalidate();
    return { ok: true, changed: ops.length, weeks: targets.length };
  } catch (e) {
    return fail(e);
  }
}

const importSchema = z.object({
  weekStart: dateSchema,
  rows: z
    .array(
      z.object({
        employeeId: z.string().min(1).max(64),
        cells: z.array(z.string().min(1).max(64).nullable()).length(7),
      }),
    )
    .max(200),
  /** Guardar el orden de las filas de la imagen como "orden del Excel" (vista Semana sin departamentos). */
  saveOrder: z.boolean().optional(),
});

/**
 * Guarda en el planning la semana leída de una imagen (ya revisada en la vista previa).
 * Solo toca las celdas con estado; las vacías (null) se dejan como estaban.
 */
export async function applyImportedWeek(input: z.input<typeof importSchema>): Promise<WeekActionResult> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const days = weekDays(weekStartOf(parsed.data.weekStart));
  const ids = parsed.data.rows.map((r) => r.employeeId);
  if (new Set(ids).size !== ids.length) return { ok: false, error: "Hay una persona asignada a dos filas." };
  try {
    const [employees, statusTypes, entries] = await Promise.all([
      getEmployees(),
      getStatusTypes(),
      getEntriesBetween(days[0]!, days[6]!),
    ]);
    const known = new Set(statusTypes.map((s) => s.id));
    const writes: { employeeId: string; date: string; plan: ReturnType<typeof planSetCell>; existing: (typeof entries)[number] | null }[] = [];
    for (const row of parsed.data.rows) {
      const employee = employees.find((e) => e.id === row.employeeId);
      if (!employee) return { ok: false, error: "Hay un empleado que ya no existe." };
      row.cells.forEach((statusTypeId, i) => {
        if (!statusTypeId || !known.has(statusTypeId)) return;
        const date = days[i]!;
        const existing = entries.find((e) => e.employeeId === employee.id && e.date === date) ?? null;
        if (existing?.statusTypeId === statusTypeId) return;
        if (!existing && getEffectiveDay(employee, date, null, statusTypes).status.id === statusTypeId) return;
        writes.push({
          employeeId: employee.id,
          date,
          existing,
          plan: planSetCell({ employee, date, statusTypeId, reason: null, existing, statusTypes }),
        });
      });
    }
    await db.$transaction(
      writes.map(({ employeeId, date, plan, existing }) =>
        plan.kind === "delete"
          ? db.dayEntry.deleteMany({ where: { employeeId, date: toDbDate(date) } })
          : db.dayEntry.upsert({
              where: { employeeId_date: { employeeId, date: toDbDate(date) } },
              update: {
                statusTypeId: plan.statusTypeId,
                reason: plan.reason,
                ...(existing && !existing.actualStatusTypeId ? { present: null } : {}),
              },
              create: { employeeId, date: toDbDate(date), statusTypeId: plan.statusTypeId, reason: plan.reason },
            }),
      ),
      { timeout: 60_000 },
    );
    for (const w of writes) {
      const employee = employees.find((e) => e.id === w.employeeId)!;
      const statusTypeId = w.plan.kind === "upsert" ? w.plan.statusTypeId : (getEffectiveDay(employee, w.date, null, statusTypes).status.id);
      await logPlanningChange(db, employee, w.date, w.existing, { statusTypeId, reason: w.plan.kind === "upsert" ? w.plan.reason : null }, statusTypes);
    }
    if (parsed.data.saveOrder) {
      // Las filas llegan en el orden de la imagen; quien no sale en ella queda al final.
      const order = new Map(ids.map((id, i) => [id, i]));
      await db.$transaction(
        employees
          .filter((e) => e.active && (e.rotaOrder ?? null) !== (order.get(e.id) ?? null))
          .map((e) => db.employee.update({ where: { id: e.id }, data: { rotaOrder: order.get(e.id) ?? null } })),
      );
      updateTag(REF_TAG);
    }
    revalidate();
    return { ok: true, changed: writes.length };
  } catch (e) {
    return fail(e);
  }
}

/** Borra los DayEntry de la semana que no tengan nota, tramos ni horarios. */
export async function resetWeek(weekStart: string): Promise<WeekActionResult> {
  const parsed = weekSchema.safeParse({ weekStart });
  if (!parsed.success) return { ok: false, error: "Fecha no válida." };
  const days = weekDays(parsed.data.weekStart);
  try {
    const res = await db.dayEntry.deleteMany({
      where: {
        date: { gte: toDbDate(days[0]!), lte: toDbDate(days[6]!) },
        arrivedAt: null,
        leftAt: null,
        timeReason: null,
        extraMinutes: null,
        extraNote: null,
        present: null,
        actualStatusTypeId: null,
        segments: { none: {} },
      },
    });
    revalidate();
    return { ok: true, changed: res.count };
  } catch (e) {
    return fail(e);
  }
}
