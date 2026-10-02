"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { addDays, isDateStr, toDbDate, weekDays, weekStart as weekStartOf } from "@/lib/dates";
import { REF_TAG, getEmployees, getEntriesBetween, getStatusTypes } from "@/lib/queries";
import { getEffectiveDay } from "@/lib/schedule";
import { planCopyWeek, planRepeatWeek, planSetCell, remainingMonthWeeks } from "@/lib/week";

export type WeekActionResult = { ok: true; changed?: number } | { ok: false; error: string };

const dateSchema = z.string().refine(isDateStr, "Fecha inválida");

const setCellSchema = z.object({
  employeeId: z.string().min(1),
  date: dateSchema,
  statusTypeId: z.string().min(1),
  reason: z.string().trim().max(200).nullish(),
});
const weekSchema = z.object({ weekStart: dateSchema });

function revalidate() {
  revalidatePath("/semana", "layout");
  revalidatePath("/hoy", "layout");
  revalidatePath("/informe", "layout");
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
    revalidate();
    return { ok: true };
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
        note: null,
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
