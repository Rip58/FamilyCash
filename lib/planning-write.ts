/**
 * Escrituras del PLANNING (DayEntry.statusTypeId) compartidas por Semana y Vacaciones: siempre con `planSetCell`
 * (borra la entrada si coincide con lo habitual) y el registro de faltas (`syncAbsence`). Solo servidor.
 */
import "server-only";
import { type AbsenceResolution } from "./absence";
import { syncAbsence } from "./absence-log";
import { type DateStr, toDbDate } from "./dates";
import { type DayEntryLite, type EmployeeLite, type StatusTypeLite, getEffectiveDay } from "./schedule";
import { planSetCell } from "./week";
import type { Prisma } from "./generated/prisma/client";

/**
 * Registro de faltas tras cambiar el planning de un día: si pasa a ser falta se apunta; si deja de serlo
 * (p. ej. se cambia a fiesta) se conserva y se anota cómo se resolvió.
 */
export async function logPlanningChange(
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


/** Pone el estado del planning de varios días de una persona (en la transacción `tx`). */
export async function writePlanningDays(
  tx: Prisma.TransactionClient,
  employee: EmployeeLite,
  days: { date: DateStr; statusTypeId: string; reason: string | null }[],
  entries: DayEntryLite[],
  statusTypes: StatusTypeLite[],
): Promise<void> {
  for (const d of days) {
    const existing = entries.find((e) => e.employeeId === employee.id && e.date === d.date) ?? null;
    const plan = planSetCell({ employee, date: d.date, statusTypeId: d.statusTypeId, reason: d.reason, existing, statusTypes });
    if (plan.kind === "delete") await tx.dayEntry.deleteMany({ where: { employeeId: employee.id, date: toDbDate(d.date) } });
    else
      await tx.dayEntry.upsert({
        where: { employeeId_date: { employeeId: employee.id, date: toDbDate(d.date) } },
        update: {
          statusTypeId: plan.statusTypeId,
          reason: plan.reason,
          ...(existing && existing.statusTypeId !== plan.statusTypeId && !existing.actualStatusTypeId ? { present: null } : {}),
        },
        create: { employeeId: employee.id, date: toDbDate(d.date), statusTypeId: plan.statusTypeId, reason: plan.reason },
      });
    await logPlanningChange(tx, employee, d.date, existing, { statusTypeId: d.statusTypeId, reason: d.reason }, statusTypes);
  }
}
