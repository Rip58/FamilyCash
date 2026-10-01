/**
 * Aplicación de cambios de calendario de las peticiones (solo servidor).
 * Misma semántica de DayEntry que la pantalla Semana (planSetCell): crea o
 * actualiza solo estado y motivo, y borra la entrada si queda redundante;
 * notas, tramos y horas extra existentes se respetan.
 */
import type { Prisma } from "@/lib/generated/prisma/client";
import { type DateStr, toDbDate } from "./dates";
import type { DayEntryLite, EmployeeLite, StatusTypeLite } from "./schedule";
import { planSetCell } from "./week";

export async function applyDayStatus(
  tx: Prisma.TransactionClient,
  input: {
    employee: EmployeeLite;
    date: DateStr;
    statusTypeId: string;
    reason: string | null;
    existing: DayEntryLite | null;
    statusTypes: StatusTypeLite[];
  },
): Promise<void> {
  const { employee, date, statusTypeId, reason, existing, statusTypes } = input;
  const plan = planSetCell({ employee, date, statusTypeId, reason, existing, statusTypes });
  if (plan.kind === "delete") {
    await tx.dayEntry.deleteMany({ where: { employeeId: employee.id, date: toDbDate(date) } });
    return;
  }
  await tx.dayEntry.upsert({
    where: { employeeId_date: { employeeId: employee.id, date: toDbDate(date) } },
    update: { statusTypeId: plan.statusTypeId, reason: plan.reason, plannedStatusTypeId: null },
    create: { employeeId: employee.id, date: toDbDate(date), statusTypeId: plan.statusTypeId, reason: plan.reason },
  });
}
