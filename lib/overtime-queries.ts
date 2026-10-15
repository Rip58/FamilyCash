/** Retrasos pendientes de recuperar (solo servidor). */
import { addDays, type DateStr, fromDbDate, toDbDate } from "./dates";
import { db } from "./db";
import { type PendingDelay, delayBalance } from "./overtime";

/** Cuántos días atrás se buscan retrasos sin recuperar. */
export const DELAY_LOOKBACK_DAYS = 120;

/** Por empleado, los retrasos que aún debe ANTES de la noche `date` (solo quien debe algo). */
export async function getPendingDelays(date: DateStr): Promise<Record<string, PendingDelay[]>> {
  const rows = await db.dayEntry.findMany({
    where: {
      date: { gte: toDbDate(addDays(date, -DELAY_LOOKBACK_DAYS)), lt: toDbDate(date) },
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
