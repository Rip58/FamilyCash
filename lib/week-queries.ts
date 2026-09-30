/**
 * Carga de datos de la pantalla Semana: una sola consulta de entradas para
 * los 7 días; la cuadrícula y los rosters diarios salen de lib/schedule.ts.
 */
import { db } from "./db";
import { type DateStr, fromDbDate, operationalToday, toDbDate, weekDays } from "./dates";
import { loadPendingCoverage } from "./employee-file-queries";
import { getDepartments, getEmployees, getEntriesBetween, getSettings, getStatusTypes } from "./queries";
import { type DayRoster, type WeekGrid, getDayRoster, getWeekGrid } from "./schedule";
import type { StatusTypeLite } from "./schedule";

export interface WeekData {
  weekStart: DateStr;
  days: DateStr[];
  grid: WeekGrid;
  rosters: DayRoster[];
  notes: Set<DateStr>;
  statusTypes: StatusTypeLite[];
  /** Día operativo actual (para resaltar «hoy»). */
  today: DateStr;
  daysOffPerWeek: number;
  /** Celdas "empleado|fecha" cubiertas por una petición pendiente -> texto. */
  pending: Record<string, string>;
}

/** `date` = cualquier día de la semana; null = semana de «hoy». */
export async function loadWeekData(requested: DateStr | null): Promise<WeekData> {
  const settings = await getSettings();
  const today = operationalToday(new Date(), settings.dayRolloverHour);
  const date = requested ?? today;
  const days = weekDays(date);
  const [employees, departments, statusTypes, entries, notes, pending] = await Promise.all([
    getEmployees(),
    getDepartments(),
    getStatusTypes(),
    getEntriesBetween(days[0]!, days[6]!),
    db.dayNote.findMany({
      where: { date: { gte: toDbDate(days[0]!), lte: toDbDate(days[6]!) }, NOT: { text: "" } },
      select: { date: true },
    }),
    loadPendingCoverage(days[0]!, days[6]!),
  ]);
  const grid = getWeekGrid({
    date,
    employees,
    entries,
    departments,
    statusTypes,
    daysOffPerWeek: settings.daysOffPerWeek,
  });
  const rosters = days.map((d) => getDayRoster({ date: d, employees, entries, departments, statusTypes }));
  return {
    weekStart: days[0]!,
    days,
    grid,
    rosters,
    notes: new Set(notes.map((n) => fromDbDate(n.date))),
    statusTypes,
    today,
    daysOffPerWeek: settings.daysOffPerWeek,
    pending,
  };
}
