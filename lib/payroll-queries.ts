import "server-only";
import { type MonthStr, addDays, fromDbDate, madridToday, addMonths, payMonthOf, payPeriodDays } from "./dates";
import { db } from "./db";
import {
  DEFAULT_PAYROLL, type MonthOverrides, type MonthStats, type NightPlusMode, type OvertimeMode, type PayrollConfig, type PayrollPeriod,
  type PayForecast, mergeStats, monthStatsFromSchedule, payForecast,
} from "./payroll";
import { getEmployees, getEntriesBetween, getSettings, getStatusTypes } from "./queries";

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
  bankCents: number | null;
  note: string | null;
}

/**
 * Meses [from..to] (ambos incluidos) con datos automáticos del cuadrante + lo escrito a mano, y el mes en curso
 * en tiempo real (`forecast`: previsión con el calendario de Semana) si hay empleado elegido.
 */
export async function loadPayrollMonths(
  from: MonthStr,
  to: MonthStr,
  employeeId: string | null,
  /** Día de cierre de la nómina (PayrollSettings.cutoffDay). */
  cutoffDay: number | null = null,
): Promise<{ months: PayrollMonth[]; forecast: PayForecast | null }> {
  const months: MonthStr[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) months.push(m);
  const first = payPeriodDays(from, cutoffDay)[0]!;
  const last = payPeriodDays(to, cutoffDay).at(-1)!;
  const [employees, statusTypes, settings, entries, slips] = await Promise.all([
    getEmployees(),
    getStatusTypes(),
    getSettings(),
    // 6 días antes: la semana del primer domingo del periodo empieza antes.
    employeeId ? getEntriesBetween(addDays(first, -6), last) : Promise.resolve([]),
    db.payslip.findMany({ where: { month: { gte: from, lte: to } } }),
  ]);
  const me = employeeId ? employees.find((e) => e.id === employeeId) : undefined;
  const byMonth = new Map(slips.map((s) => [s.month, s]));
  const today = madridToday();
  const current = payMonthOf(today, cutoffDay);
  const forecast =
    me && current >= from && current <= to
      ? payForecast(current, me, entries, statusTypes, settings.daysOffPerWeek, today, cutoffDay)
      : null;
  const list = months.map((month) => {
    const auto: MonthStats = me
      ? monthStatsFromSchedule(month, me, entries, statusTypes, settings.daysOffPerWeek, today, cutoffDay)
      : { daysInMonth: payPeriodDays(month, cutoffDay).length, daysWorked: 0, daysOff: 0, vacationDays: 0, sickDays: 0, absentDays: 0, holidaysWorked: 0, offDaysWorked: 0, extraMinutes: 0 };
    const s = byMonth.get(month);
    const overrides: MonthOverrides = s
      ? {
          contractDays: s.contractDays, daysOff: s.daysOff, vacationDays: s.vacationDays, sickDays: s.sickDays,
          absentDays: s.absentDays, holidaysWorked: s.holidaysWorked, offDaysWorked: s.offDaysWorked, extraMinutes: s.extraMinutes,
        }
      : {};
    return {
      month,
      auto,
      overrides,
      stats: mergeStats(auto, overrides),
      grossCents: s?.grossCents ?? null,
      netCents: s?.netCents ?? null,
      bankCents: s?.bankCents ?? null,
      note: s?.note ?? null,
    };
  });
  return { months: list, forecast };
}
