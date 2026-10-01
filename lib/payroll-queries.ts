import "server-only";
import { type MonthStr, addMonths, fromDbDate, monthDays } from "./dates";
import { db } from "./db";
import {
  DEFAULT_PAYROLL, type MonthOverrides, type MonthStats, type NightPlusMode, type OvertimeMode, type PayrollConfig, type PayrollPeriod,
  mergeStats, monthStatsFromSchedule,
} from "./payroll";
import { getEmployees, getEntriesBetween, getStatusTypes } from "./queries";

export async function getPayrollConfig(): Promise<PayrollConfig> {
  const row = await db.payrollSettings.findUnique({ where: { id: 1 } });
  if (!row) return DEFAULT_PAYROLL;
  const { id: _id, ...rest } = row;
  void _id;
  return { ...rest, nightPlusMode: rest.nightPlusMode as NightPlusMode, overtimeMode: rest.overtimeMode as OvertimeMode };
}

export async function getPayrollPeriods(): Promise<PayrollPeriod[]> {
  const rows = await db.payrollPeriod.findMany({ orderBy: { from: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    from: fromDbDate(r.from),
    to: r.to ? fromDbDate(r.to) : null,
    baseCents: r.baseCents,
    respPlusCents: r.respPlusCents,
  }));
}

export interface PayrollMonth {
  month: MonthStr;
  auto: MonthStats;
  overrides: MonthOverrides;
  stats: MonthStats;
  grossCents: number | null;
  netCents: number | null;
  note: string | null;
}

/** Meses [from..to] (ambos incluidos) con datos automáticos del cuadrante + lo escrito a mano. */
export async function loadPayrollMonths(from: MonthStr, to: MonthStr, employeeId: string | null): Promise<PayrollMonth[]> {
  const months: MonthStr[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) months.push(m);
  const first = monthDays(from)[0]!;
  const last = monthDays(to).at(-1)!;
  const [employees, statusTypes, entries, slips] = await Promise.all([
    getEmployees(),
    getStatusTypes(),
    employeeId ? getEntriesBetween(first, last) : Promise.resolve([]),
    db.payslip.findMany({ where: { month: { gte: from, lte: to } } }),
  ]);
  const me = employeeId ? employees.find((e) => e.id === employeeId) : undefined;
  const byMonth = new Map(slips.map((s) => [s.month, s]));
  return months.map((month) => {
    const auto: MonthStats = me
      ? monthStatsFromSchedule(month, me, entries, statusTypes)
      : { daysInMonth: monthDays(month).length, daysWorked: 0, daysOff: 0, vacationDays: 0, sickDays: 0, absentDays: 0, holidaysWorked: 0, extraMinutes: 0 };
    const s = byMonth.get(month);
    const overrides: MonthOverrides = s
      ? {
          contractDays: s.contractDays, daysOff: s.daysOff, vacationDays: s.vacationDays, sickDays: s.sickDays,
          absentDays: s.absentDays, holidaysWorked: s.holidaysWorked, extraMinutes: s.extraMinutes,
        }
      : {};
    return {
      month,
      auto,
      overrides,
      stats: mergeStats(auto, overrides),
      grossCents: s?.grossCents ?? null,
      netCents: s?.netCents ?? null,
      note: s?.note ?? null,
    };
  });
}
