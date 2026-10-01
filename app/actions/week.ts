"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { addDays, isDateStr, toDbDate, weekDays, weekStart as weekStartOf } from "@/lib/dates";
import { getEmployees, getEntriesBetween, getStatusTypes } from "@/lib/queries";
import { planCopyWeek, planSetCell } from "@/lib/week";

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
          plannedStatusTypeId: null,
          ...(statusTypes.find((s) => s.id === plan.statusTypeId)?.isWorking ? {} : { present: null }),
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
              update: { statusTypeId: op.statusTypeId, departmentId: op.departmentId, reason: op.reason, plannedStatusTypeId: null },
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
        segments: { none: {} },
      },
    });
    revalidate();
    return { ok: true, changed: res.count };
  } catch (e) {
    return fail(e);
  }
}
