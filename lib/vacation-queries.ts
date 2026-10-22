/** Vacaciones: lecturas (solo servidor). */
import "server-only";
import { db } from "./db";
import { fromDbDate } from "./dates";
import { VACATION_YEAR, type VacationCampaignView, type VacationWeekView, parseDepartmentMax, pickPin } from "./vacations";

export async function getVacationCampaign(year: number = VACATION_YEAR): Promise<VacationCampaignView | null> {
  const c = await db.vacationCampaign.findUnique({ where: { year } });
  if (!c) return null;
  return {
    year: c.year,
    workDays: c.workDays,
    deadline: fromDbDate(c.deadline),
    open: c.open,
    defaultMax: c.defaultMax,
    departmentMax: parseDepartmentMax(c.departmentMax),
  };
}

/** Semanas con regla propia del año (por su lunes; la del 28 dic 2026 cuenta para 2027). */
export async function getVacationWeeks(year: number = VACATION_YEAR): Promise<VacationWeekView[]> {
  const rows = await db.vacationWeek.findMany({
    where: { weekStart: { gte: new Date(Date.UTC(year - 1, 11, 25)), lte: new Date(Date.UTC(year, 11, 31)) } },
    orderBy: { weekStart: "asc" },
  });
  return rows.map((w) => ({ weekStart: fromDbDate(w.weekStart), blocked: w.blocked, reason: w.reason, maxOverride: w.maxOverride }));
}

/**
 * PIN fijo de vacaciones de cada empleado (se crea la primera vez que hace falta y ya no cambia).
 * Devuelve el mapa employeeId → PIN de los pedidos.
 */
export async function ensureVacationPins(employeeIds: string[]): Promise<Map<string, string>> {
  const all = await db.vacationPin.findMany({ select: { employeeId: true, pin: true } });
  const byEmployee = new Map(all.map((p) => [p.employeeId, p.pin]));
  const taken = new Set(all.map((p) => p.pin));
  for (const id of employeeIds) {
    if (byEmployee.has(id)) continue;
    // Reintenta si otro proceso se llevó el mismo PIN a la vez (índice único).
    for (let attempt = 0; attempt < 5; attempt++) {
      const pin = pickPin(taken);
      try {
        await db.vacationPin.create({ data: { employeeId: id, pin } });
        byEmployee.set(id, pin);
        taken.add(pin);
        break;
      } catch {
        const again = await db.vacationPin.findUnique({ where: { employeeId: id } });
        if (again) {
          byEmployee.set(id, again.pin);
          break;
        }
        taken.add(pin);
      }
    }
  }
  return new Map(employeeIds.flatMap((id) => (byEmployee.has(id) ? [[id, byEmployee.get(id)!] as const] : [])));
}
