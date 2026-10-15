/** Retrasos pendientes de recuperar (solo servidor). */
import { type DateStr, fromDbDate, payMonthOf, payPeriodDays, toDbDate } from "./dates";
import { db } from "./db";
import { type PendingDelay, delayBalance } from "./overtime";
import { getPayrollConfig } from "./payroll-queries";

/**
 * Por empleado, los retrasos que aún debe ANTES de la noche `date` (solo quien debe algo). Solo cuenta el mes de
 * nómina de esa noche (con su día de cierre): lo que no se recupera en el mes se arregla en la nómina.
 */
export async function getPendingDelays(date: DateStr): Promise<Record<string, PendingDelay[]>> {
  const cutoff = (await getPayrollConfig()).cutoffDay;
  const first = payPeriodDays(payMonthOf(date, cutoff), cutoff)[0]!;
  if (first >= date) return {};
  const rows = await db.dayEntry.findMany({
    where: {
      date: { gte: toDbDate(first), lt: toDbDate(date) },
      extraMinutes: { not: null },
    },
    select: { employeeId: true, date: true, extraMinutes: true, extraRecovers: true },
  });
  const byEmployee = new Map<string, { date: string; extraMinutes: number | null; extraRecovers: boolean }[]>();
  for (const r of rows) {
    const list = byEmployee.get(r.employeeId) ?? [];
    list.push({ date: fromDbDate(r.date), extraMinutes: r.extraMinutes, extraRecovers: r.extraRecovers });
    byEmployee.set(r.employeeId, list);
  }
  const out: Record<string, PendingDelay[]> = {};
  for (const [id, list] of byEmployee) {
    const b = delayBalance(list);
    if (b.owed > 0) out[id] = b.pending;
  }
  return out;
}
