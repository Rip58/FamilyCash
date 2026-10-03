/**
 * Nómina personal (lógica pura): resumen del mes a partir del cuadrante y
 * calculadora de bruto/neto. Importes en céntimos; porcentajes en %.
 * Es una estimación: no sustituye a la nómina oficial.
 */
import { type DateStr, type MonthStr, addDays, monthDays, payPeriodDays, weekdayIndex } from "./dates";
import { type DayEntryLite, type EmployeeLite, type StatusTypeLite, getEffectiveDay } from "./schedule";

export type NightPlusMode = "PER_NIGHT" | "PERCENT";
/** LAW: precio por ley de Andorra (art. 58.2 LRL: fijo/h + recargo, más nocturnidad/h de noche); FIXED: precio fijo. */
export type OvertimeMode = "LAW" | "FIXED";
export type ShiftKind = "NIGHT" | "DAY";

export interface PayrollConfig {
  employeeId: string | null;
  /** Día de cierre de la nómina: lo de después (horas, fiestas…) pasa a la del mes siguiente. null = mes natural. */
  cutoffDay: number | null;
  /** Salario base si ningún periodo cubre el mes. */
  baseMonthlyCents: number;
  respPlusCents: number;
  proratedExtraCents: number;
  nightPlusMode: NightPlusMode;
  /** € por noche trabajada (céntimos) si PER_NIGHT. */
  nightPlusPerNightCents: number;
  /** % del salario base si PERCENT. */
  nightPlusPercent: number;
  overtimeMode: OvertimeMode;
  /** Recargo sobre el precio/hora fijo (mínimo legal 40 %). */
  overtimeSurchargePercent: number;
  /** Precio por hora si overtimeMode = FIXED. */
  overtimeHourCents: number;
  holidayWorkedCents: number;
  ssPercent: number;
  irpfPercent: number;
}

export const DEFAULT_PAYROLL: PayrollConfig = {
  employeeId: null,
  cutoffDay: 27,
  baseMonthlyCents: 0,
  respPlusCents: 0,
  proratedExtraCents: 0,
  nightPlusMode: "PERCENT",
  nightPlusPerNightCents: 0,
  nightPlusPercent: 25,
  overtimeMode: "LAW",
  overtimeSurchargePercent: 40,
  overtimeHourCents: 0,
  holidayWorkedCents: 0,
  ssPercent: 6.48,
  irpfPercent: 12,
};

/** Tramo de salario (fechas incluidas; to null = indefinido). */
export interface PayrollPeriod {
  id: string;
  from: DateStr;
  to: DateStr | null;
  baseCents: number;
  respPlusCents: number;
}

/** Periodo que aplica a un mes: el último que ha empezado antes de fin de mes y no ha terminado antes de que empiece. */
export function periodForMonth(periods: PayrollPeriod[], month: MonthStr): PayrollPeriod | null {
  const days = monthDays(month);
  const first = days[0]!;
  const last = days.at(-1)!;
  const active = periods
    .filter((p) => p.from <= last && (p.to === null || p.to >= first))
    .sort((a, b) => b.from.localeCompare(a.from));
  return active[0] ?? null;
}

/** Config con el salario del periodo del mes (si lo hay). */
export function configForMonth(cfg: PayrollConfig, periods: PayrollPeriod[], month: MonthStr): PayrollConfig {
  const p = periodForMonth(periods, month);
  return p ? { ...cfg, baseMonthlyCents: p.baseCents, respPlusCents: p.respPlusCents } : cfg;
}

/** Datos del mes (días por tipo y horas extra). */
export interface MonthStats {
  /** Días del periodo de la nómina (del cierre anterior al cierre de este mes). */
  daysInMonth: number;
  /** Días de contrato en el mes (alta o baja a mitad de mes); ausente = mes completo. */
  contractDays?: number;
  daysWorked: number;
  daysOff: number;
  vacationDays: number;
  sickDays: number;
  absentDays: number;
  holidaysWorked: number;
  /** Días de fiesta trabajados (noches por encima de 5 en una semana): cada uno son 8 h extra. */
  offDaysWorked: number;
  extraMinutes: number;
}

/** Valores escritos a mano (null = automático). Los días trabajados nunca se escriben: se deducen. */
export type MonthOverrides = Partial<Record<keyof Omit<MonthStats, "daysInMonth" | "daysWorked">, number | null>>;

/** Cuenta el mes del empleado con el "día efectivo" de lib/schedule. */
export function monthStatsFromSchedule(
  month: MonthStr,
  employee: EmployeeLite,
  entries: DayEntryLite[],
  statusTypes: StatusTypeLite[],
  daysOffPerWeek = 2,
  /** Hasta qué día contar fiestas trabajadas; las semanas futuras aún no están cerradas (= mes estándar). */
  until?: DateStr,
  /** Día de cierre de la nómina (ver `payPeriodDays`); sin él, mes natural. */
  cutoffDay?: number | null,
): MonthStats {
  const byDate = new Map<DateStr, DayEntryLite>(
    entries.filter((e) => e.employeeId === employee.id).map((e) => [e.date, e]),
  );
  const days = payPeriodDays(month, cutoffDay);
  const s: MonthStats = {
    daysInMonth: days.length,
    daysWorked: 0,
    daysOff: 0,
    vacationDays: 0,
    sickDays: 0,
    absentDays: 0,
    holidaysWorked: 0,
    offDaysWorked: 0,
    extraMinutes: 0,
  };
  // Fiestas trabajadas por semanas (lunes–domingo); cada semana cuenta en el periodo de su domingo.
  const workingNights = 7 - daysOffPerWeek;
  for (const sunday of days.filter((d) => weekdayIndex(d) === 6 && (!until || d <= until))) {
    let worked = 0;
    for (let i = 6; i >= 0; i--) {
      if (getEffectiveDay(employee, addDays(sunday, -i), byDate.get(addDays(sunday, -i)), statusTypes).isWorking) worked++;
    }
    s.offDaysWorked += Math.max(worked - workingNights, 0);
  }
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

/** El mes en curso: lo que ya ha pasado (hasta hoy incluido) y lo que dice el planning para el resto. */
export interface MonthProgress {
  today: DateStr;
  /** Días del mes que quedan después de hoy. */
  daysLeft: number;
  /** Solo días ≤ hoy; fiestas trabajadas de las semanas ya cerradas. */
  soFar: MonthStats;
  /** Todo el mes según el planning de Semana (fiestas trabajadas de todas las semanas del mes). */
  planned: MonthStats;
  /** Fiestas (libranzas) que el planning pone en los días que quedan. */
  plannedOffLeft: number;
  /** Días que quedan con vacaciones, baja o falta en el planning (no se tocan al estimar). */
  awayLeft: number;
}

export function monthProgress(
  month: MonthStr,
  employee: EmployeeLite,
  entries: DayEntryLite[],
  statusTypes: StatusTypeLite[],
  daysOffPerWeek: number,
  today: DateStr,
  cutoffDay?: number | null,
): MonthProgress {
  const days = payPeriodDays(month, cutoffDay);
  const left = days.filter((d) => d > today);
  const mine = entries.filter((e) => e.employeeId === employee.id);
  const planned = monthStatsFromSchedule(month, employee, mine, statusTypes, daysOffPerWeek, undefined, cutoffDay);
  // Lo que el planning pone después de hoy; "hasta hoy" = el mes menos eso.
  const leftStats = { daysWorked: 0, daysOff: 0, vacationDays: 0, sickDays: 0, absentDays: 0, extraMinutes: 0 };
  const byDate = new Map(mine.map((e) => [e.date, e]));
  for (const d of left) {
    const day = getEffectiveDay(employee, d, byDate.get(d), statusTypes);
    if (day.isWorking) {
      leftStats.daysWorked++;
      leftStats.extraMinutes += day.extraMinutes ?? 0;
    } else if (day.isDayOff) leftStats.daysOff++;
    else if (day.status.code === "VACATION") leftStats.vacationDays++;
    else if (day.status.code === "SICK") leftStats.sickDays++;
    else leftStats.absentDays++;
  }
  const closed = monthStatsFromSchedule(month, employee, mine, statusTypes, daysOffPerWeek, today, cutoffDay);
  const soFar: MonthStats = {
    ...planned,
    daysWorked: planned.daysWorked - leftStats.daysWorked,
    daysOff: planned.daysOff - leftStats.daysOff,
    vacationDays: planned.vacationDays - leftStats.vacationDays,
    sickDays: planned.sickDays - leftStats.sickDays,
    absentDays: planned.absentDays - leftStats.absentDays,
    extraMinutes: planned.extraMinutes - leftStats.extraMinutes,
    offDaysWorked: closed.offDaysWorked,
  };
  const awayLeft = leftStats.vacationDays + leftStats.sickDays + leftStats.absentDays;
  return { today, daysLeft: left.length, soFar, planned, plannedOffLeft: leftStats.daysOff, awayLeft };
}

/**
 * Proyección del mes: el planning, cambiando las fiestas de los días que quedan por las estimadas.
 * Cada fiesta de menos respecto al planning es una noche más trabajada (+8 h extra); cada una de más, al revés
 * (sin bajar de las fiestas trabajadas de las semanas ya cerradas).
 */
export function projectMonth(p: MonthProgress, offLeft: number, extraLeftMinutes = 0): MonthStats {
  const off = Math.min(Math.max(offLeft, 0), p.daysLeft - p.awayLeft);
  const delta = p.plannedOffLeft - off;
  return {
    ...p.planned,
    daysOff: p.planned.daysOff - delta,
    daysWorked: p.planned.daysWorked + delta,
    offDaysWorked: Math.max(p.planned.offDaysWorked + delta, p.soFar.offDaysWorked),
    extraMinutes: p.planned.extraMinutes + extraLeftMinutes,
  };
}

/**
 * Aplica los valores escritos a mano sobre los automáticos (null = automático).
 * Días trabajados = días de contrato − fiestas − vacaciones − baja − faltas.
 */
export function mergeStats(auto: MonthStats, o: MonthOverrides): MonthStats {
  const pick = (k: Exclude<keyof MonthOverrides, "contractDays">) => o[k] ?? auto[k];
  const contract = Math.min(o.contractDays ?? auto.contractDays ?? auto.daysInMonth, auto.daysInMonth);
  const daysOff = pick("daysOff");
  const vacationDays = pick("vacationDays");
  const sickDays = pick("sickDays");
  const absentDays = pick("absentDays");
  return {
    daysInMonth: auto.daysInMonth,
    ...(contract < auto.daysInMonth ? { contractDays: contract } : {}),
    daysWorked: Math.max(contract - daysOff - vacationDays - sickDays - absentDays, 0),
    daysOff,
    vacationDays,
    sickDays,
    absentDays,
    holidaysWorked: pick("holidaysWorked"),
    offDaysWorked: pick("offDaysWorked"),
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
const pct = (n: number) => `${String(n).replace(".", ",")} %`;

/** Horas ordinarias al mes con 40 h/semana (art. 76.2 LRL: mensual × 12 / 52 / 40). */
export const MONTHLY_HOURS = (40 * 52) / 12;
export const SHIFT_HOURS = 8;

/** Nocturnidad por hora (céntimos). */
export function nightPlusPerHourCents(cfg: PayrollConfig): number {
  return cfg.nightPlusMode === "PER_NIGHT"
    ? cfg.nightPlusPerNightCents / SHIFT_HOURS
    : (cfg.baseMonthlyCents * cfg.nightPlusPercent) / 100 / MONTHLY_HOURS;
}

/** Precio de la hora extra (céntimos, sin redondear). */
export function overtimeRateCents(cfg: PayrollConfig, shift: ShiftKind): number {
  if (cfg.overtimeMode === "FIXED") return cfg.overtimeHourCents;
  const fixedHour = (cfg.baseMonthlyCents + cfg.respPlusCents) / MONTHLY_HOURS;
  return fixedHour * (1 + cfg.overtimeSurchargePercent / 100) + (shift === "NIGHT" ? nightPlusPerHourCents(cfg) : 0);
}

/** Horas extra por fiestas trabajadas: 8 h por cada una. */
export function offDayOvertimeMinutes(stats: MonthStats): number {
  return stats.offDaysWorked * SHIFT_HOURS * 60;
}

/**
 * IRPF anual de Andorra (Llei 5/2014) para un bruto anual: base = bruto − CASS − 3 % (máx. 2.500 €)
 * − mínimo personal 24.000 € − 750 €/hijo; cuota 10 % con bonificación del 50 % (máx. 800 €).
 */
export function andorraIrpfAnnualCents(annualGrossCents: number, cassPercent: number, children = 0): number {
  const g = annualGrossCents;
  const base = g - (g * cassPercent) / 100 - Math.min(g * 0.03, 250000) - 2400000 - 75000 * children;
  if (base <= 0) return 0;
  const quota = base * 0.1;
  return round(quota - Math.min(quota * 0.5, 80000));
}

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
  const contract = stats.contractDays ?? stats.daysInMonth;
  const partial = contract < stats.daysInMonth;
  const f = partial ? Math.min(contract, 30) / 30 : 1;
  const partialDetail = partial ? `${contract}/30 días` : undefined;
  add("base", "Salario base", cfg.baseMonthlyCents * f, partialDetail);
  if (stats.absentDays > 0) {
    add("absent", "Descuento por faltas", -(cfg.baseMonthlyCents / 30) * stats.absentDays, `${stats.absentDays} días`);
  }
  add("resp", "Plus responsabilidad", cfg.respPlusCents * f, partialDetail);
  add("prorated", "Prorrata pagas extra", cfg.proratedExtraCents * f, partialDetail);
  if (shift === "NIGHT") {
    if (cfg.nightPlusMode === "PER_NIGHT") {
      add("night", "Plus nocturnidad", cfg.nightPlusPerNightCents * stats.daysWorked, `${stats.daysWorked} noches`);
    } else {
      // Plus fijo del mes; solo se reduce por los días sin trabajar (vacaciones, baja, faltas).
      const away = stats.vacationDays + stats.sickDays + stats.absentDays;
      const share = contract > 0 ? Math.max(contract - away, 0) / contract : 0;
      add(
        "night",
        "Plus nocturnidad",
        cfg.baseMonthlyCents * (cfg.nightPlusPercent / 100) * f * share,
        away > 0 ? `${pct(cfg.nightPlusPercent)} · sin ${away} días fuera` : pct(cfg.nightPlusPercent),
      );
    }
  }
  const rate = overtimeRateCents(cfg, shift);
  const offMinutes = offDayOvertimeMinutes(stats);
  add(
    "over40",
    "Horas extra (fiestas trabajadas)",
    (rate * offMinutes) / 60,
    `${stats.offDaysWorked} × 8 h × ${formatEuros(round(rate))}`,
  );
  add(
    "overtime",
    "Horas extra (cierre de turno)",
    (rate * stats.extraMinutes) / 60,
    `${formatHours(stats.extraMinutes)} h × ${formatEuros(round(rate))}`,
  );
  add("holiday", "Festivos trabajados", cfg.holidayWorkedCents * stats.holidaysWorked, `${stats.holidaysWorked} días`);

  const grossCents = Math.max(earnings.reduce((n, l) => n + l.cents, 0), 0);
  const deductions: PayLine[] = [
    { key: "ss", label: "CASS", cents: round((grossCents * cfg.ssPercent) / 100), detail: pct(cfg.ssPercent) },
    { key: "irpf", label: "IRPF", cents: round((grossCents * cfg.irpfPercent) / 100), detail: pct(cfg.irpfPercent) },
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

/** "2026-09-21" → "21/09/2026". */
export function formatDateEs(date: DateStr): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}
