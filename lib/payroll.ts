/**
 * Nómina personal (lógica pura): resumen del mes a partir del cuadrante y
 * calculadora de bruto/neto. Importes en céntimos; porcentajes en %.
 * Es una estimación: no sustituye a la nómina oficial.
 */
import { type DateStr, type MonthStr, monthDays } from "./dates";
import { type DayEntryLite, type EmployeeLite, type StatusTypeLite, getEffectiveDay } from "./schedule";

export type NightPlusMode = "PER_NIGHT" | "PERCENT";
export type ShiftKind = "NIGHT" | "DAY";

export interface PayrollConfig {
  employeeId: string | null;
  baseMonthlyCents: number;
  proratedExtraCents: number;
  nightPlusMode: NightPlusMode;
  /** € por noche trabajada (céntimos) si PER_NIGHT. */
  nightPlusPerNightCents: number;
  /** % del salario base si PERCENT. */
  nightPlusPercent: number;
  overtimeHourCents: number;
  holidayWorkedCents: number;
  ssPercent: number;
  irpfPercent: number;
}

export const DEFAULT_PAYROLL: PayrollConfig = {
  employeeId: null,
  baseMonthlyCents: 0,
  proratedExtraCents: 0,
  nightPlusMode: "PERCENT",
  nightPlusPerNightCents: 0,
  nightPlusPercent: 25,
  overtimeHourCents: 0,
  holidayWorkedCents: 0,
  ssPercent: 6.48,
  irpfPercent: 12,
};

/** Datos del mes (días por tipo y horas extra). */
export interface MonthStats {
  daysInMonth: number;
  daysWorked: number;
  daysOff: number;
  vacationDays: number;
  sickDays: number;
  absentDays: number;
  holidaysWorked: number;
  extraMinutes: number;
}

export type MonthOverrides = Partial<Record<keyof Omit<MonthStats, "daysInMonth">, number | null>>;

/** Cuenta el mes del empleado con el "día efectivo" de lib/schedule. */
export function monthStatsFromSchedule(
  month: MonthStr,
  employee: EmployeeLite,
  entries: DayEntryLite[],
  statusTypes: StatusTypeLite[],
): MonthStats {
  const byDate = new Map<DateStr, DayEntryLite>(
    entries.filter((e) => e.employeeId === employee.id).map((e) => [e.date, e]),
  );
  const days = monthDays(month);
  const s: MonthStats = {
    daysInMonth: days.length,
    daysWorked: 0,
    daysOff: 0,
    vacationDays: 0,
    sickDays: 0,
    absentDays: 0,
    holidaysWorked: 0,
    extraMinutes: 0,
  };
  for (const d of days) {
    const day = getEffectiveDay(employee, d, byDate.get(d), statusTypes);
    if (day.isWorking) {
      s.daysWorked++;
      s.extraMinutes += day.extraMinutes ?? 0;
    } else if (day.isDayOff) s.daysOff++;
    else if (day.status.code === "VACATION") s.vacationDays++;
    else if (day.status.code === "SICK") s.sickDays++;
    else s.absentDays++;
  }
  return s;
}

/** Aplica los valores escritos a mano sobre los automáticos (null = automático). */
export function mergeStats(auto: MonthStats, o: MonthOverrides): MonthStats {
  const pick = (k: keyof MonthOverrides) => o[k] ?? auto[k];
  return {
    daysInMonth: auto.daysInMonth,
    daysWorked: pick("daysWorked"),
    daysOff: pick("daysOff"),
    vacationDays: pick("vacationDays"),
    sickDays: pick("sickDays"),
    absentDays: pick("absentDays"),
    holidaysWorked: pick("holidaysWorked"),
    extraMinutes: pick("extraMinutes"),
  };
}

export interface PayLine {
  key: string;
  label: string;
  cents: number;
  detail?: string;
}

export interface PayResult {
  earnings: PayLine[];
  grossCents: number;
  deductions: PayLine[];
  netCents: number;
}

const round = (n: number) => Math.round(n);

/**
 * Calcula bruto y neto. Las faltas descuentan base/30 por día; el plus de
 * noche solo aplica al turno de noche (por noche trabajada o % de la base
 * proporcional a las noches trabajadas sobre las laborables del mes).
 */
export function calculatePay(cfg: PayrollConfig, stats: MonthStats, shift: ShiftKind): PayResult {
  const earnings: PayLine[] = [];
  const add = (key: string, label: string, cents: number, detail?: string) => {
    if (cents !== 0) earnings.push({ key, label, cents: round(cents), detail });
  };
  add("base", "Salario base", cfg.baseMonthlyCents);
  if (stats.absentDays > 0) {
    add("absent", "Descuento por faltas", -(cfg.baseMonthlyCents / 30) * stats.absentDays, `${stats.absentDays} días`);
  }
  add("prorated", "Prorrata pagas extra", cfg.proratedExtraCents);
  if (shift === "NIGHT") {
    if (cfg.nightPlusMode === "PER_NIGHT") {
      add("night", "Plus nocturnidad", cfg.nightPlusPerNightCents * stats.daysWorked, `${stats.daysWorked} noches`);
    } else {
      const workable = Math.max(stats.daysInMonth - stats.daysOff, 0);
      const share = workable > 0 ? Math.min(stats.daysWorked / workable, 1) : 0;
      add(
        "night",
        "Plus nocturnidad",
        cfg.baseMonthlyCents * (cfg.nightPlusPercent / 100) * share,
        `${cfg.nightPlusPercent}% · ${stats.daysWorked}/${workable} noches`,
      );
    }
  }
  add("overtime", "Horas extra", (cfg.overtimeHourCents * stats.extraMinutes) / 60, `${formatHours(stats.extraMinutes)} h`);
  add("holiday", "Festivos trabajados", cfg.holidayWorkedCents * stats.holidaysWorked, `${stats.holidaysWorked} días`);

  const grossCents = Math.max(earnings.reduce((n, l) => n + l.cents, 0), 0);
  const deductions: PayLine[] = [
    { key: "ss", label: "Seguridad Social", cents: round((grossCents * cfg.ssPercent) / 100), detail: `${cfg.ssPercent}%` },
    { key: "irpf", label: "IRPF", cents: round((grossCents * cfg.irpfPercent) / 100), detail: `${cfg.irpfPercent}%` },
  ];
  const netCents = grossCents - deductions.reduce((n, l) => n + l.cents, 0);
  return { earnings, grossCents, deductions, netCents };
}

/** 90 → "1,5". */
export function formatHours(minutes: number): string {
  return String(Math.round((minutes / 60) * 100) / 100).replace(".", ",");
}

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export function formatEuros(cents: number): string {
  return EUR.format(cents / 100);
}

/** "1.234,56" o "1234.5" → céntimos (null si no es un importe válido). */
export function parseEuros(text: string): number | null {
  const t = text.trim().replace(/\s|€/g, "");
  if (!t) return 0;
  const thousands = /^\d{1,3}(\.\d{3})+$/.test(t);
  const normalized = t.includes(",") || thousands ? t.replace(/\./g, "").replace(",", ".") : t;
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}
