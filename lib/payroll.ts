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
  /** Sueldo bruto de un mes entero a 48 h (del periodo); si está, el plus de 48 h y la hora extra salen de él. */
  gross48Cents?: number | null;
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
  /** "Salari brut 48 h" de la propuesta de la empresa (sueldo de un mes entero a 48 h/semana); null = no se sabe. */
  gross48Cents?: number | null;
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
  return p
    ? { ...cfg, baseMonthlyCents: p.baseCents, respPlusCents: p.respPlusCents, gross48Cents: p.gross48Cents ?? null }
    : cfg;
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
  /** Semanas (lunes–domingo) que cuentan en esta nómina y cuántas de ellas a 48 h (6 noches o más). */
  weeks?: number;
  weeks48?: number;
}

/** Valores escritos a mano (null = automático). Los días trabajados nunca se escriben: se deducen. */
export type MonthOverrides = Partial<Record<keyof Omit<MonthStats, "daysInMonth" | "daysWorked" | "weeks" | "weeks48">, number | null>>;

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
    if (worked > workingNights) s.weeks48 = (s.weeks48 ?? 0) + 1;
  }
  s.weeks = days.filter((d) => weekdayIndex(d) === 6).length;
  s.weeks48 ??= 0;
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

/** Una semana (lunes–domingo) de la previsión de la nómina. */
export interface ForecastWeek {
  monday: DateStr;
  sunday: DateStr;
  nights: number;
  offs: number;
  /** Vacaciones, baja, faltas… */
  away: number;
  /** Horas de la semana: noches × 8. */
  hours: number;
  /** Horas extra por noches de más (más de las del contrato): 8 h cada una. */
  extraHours: number;
  /** cerrada = ya pasó · en-curso = incluye hoy · planificada = futura con planning en Semana ·
   *  estimada = futura sin planning (se cuenta como una semana normal). */
  state: "cerrada" | "en-curso" | "planificada" | "estimada";
}

/** Previsión de la nómina de un mes (periodo de cierre a cierre) con el calendario de Semana. */
export interface PayForecast {
  from: DateStr;
  to: DateStr;
  /** Semanas cuyo domingo cae en el periodo (sus horas extra van en esta nómina). */
  weeks: ForecastWeek[];
  /** Días del final del periodo cuya semana termina después (sus horas extra van en la nómina siguiente). */
  tail: { from: DateStr; to: DateStr; nights: number } | null;
  /** Días del periodo: trabajados, fiestas, fuera (vacaciones/baja/faltas). */
  nights: number;
  offs: number;
  away: number;
  /** Horas trabajadas en el periodo (noches × 8 + horas de cierre). */
  hours: number;
  /** Horas extra de la nómina: noches de más × 8 + horas de cierre. */
  extraHours: number;
  closingMinutes: number;
  /** Días del periodo sin planning (estimados como semana normal). */
  estimatedDays: number;
  stats: MonthStats;
}

/**
 * Previsión de la nómina de `month` con lo que hay en Semana (y lo validado en Hoy). Las semanas futuras sin
 * nada en el planning se cuentan como una semana normal (lunes–viernes trabaja, fines de semana fiesta, o sus
 * fiestas fijas) para no inflar las horas extra.
 */
export function payForecast(
  month: MonthStr,
  employee: EmployeeLite,
  entries: DayEntryLite[],
  statusTypes: StatusTypeLite[],
  daysOffPerWeek: number,
  today: DateStr,
  cutoffDay?: number | null,
): PayForecast {
  const days = payPeriodDays(month, cutoffDay);
  const from = days[0]!;
  const to = days.at(-1)!;
  const mine = entries.filter((e) => e.employeeId === employee.id);
  const byDate = new Map(mine.map((e) => [e.date, e]));
  const workingNights = 7 - daysOffPerWeek;
  const weekPlanned = (monday: DateStr) => {
    for (let i = 0; i < 7; i++) if (byDate.has(addDays(monday, i))) return true;
    return false;
  };
  type Kind = "work" | "off" | "vacation" | "sick" | "absent";
  /** Qué pasa ese día; en semanas futuras sin planning, el patrón normal. */
  const kindOf = (d: DateStr, estimated: boolean): { kind: Kind; extra: number } => {
    if (estimated && employee.fixedDaysOff.length === 0) {
      return { kind: weekdayIndex(d) >= workingNights ? "off" : "work", extra: 0 };
    }
    const day = getEffectiveDay(employee, d, byDate.get(d), statusTypes);
    if (day.isWorking) return { kind: "work", extra: day.extraMinutes ?? 0 };
    if (day.isDayOff) return { kind: "off", extra: 0 };
    if (day.status.code === "VACATION") return { kind: "vacation", extra: 0 };
    if (day.status.code === "SICK") return { kind: "sick", extra: 0 };
    return { kind: "absent", extra: 0 };
  };
  const mondayOf = (d: DateStr) => addDays(d, -weekdayIndex(d));
  const isEstimated = (monday: DateStr) => monday > today && !weekPlanned(monday);

  const weeks: ForecastWeek[] = days
    .filter((d) => weekdayIndex(d) === 6)
    .map((sunday) => {
      const monday = addDays(sunday, -6);
      const estimated = isEstimated(monday);
      let nights = 0;
      let offs = 0;
      let away = 0;
      for (let i = 0; i < 7; i++) {
        const k = kindOf(addDays(monday, i), estimated).kind;
        if (k === "work") nights++;
        else if (k === "off") offs++;
        else away++;
      }
      const state: ForecastWeek["state"] =
        sunday < today ? "cerrada" : monday <= today ? "en-curso" : estimated ? "estimada" : "planificada";
      return { monday, sunday, nights, offs, away, hours: nights * 8, extraHours: Math.max(nights - workingNights, 0) * 8, state };
    });

  const stats: MonthStats = {
    daysInMonth: days.length,
    daysWorked: 0,
    daysOff: 0,
    vacationDays: 0,
    sickDays: 0,
    absentDays: 0,
    holidaysWorked: 0,
    offDaysWorked: weeks.reduce((n, w) => n + w.extraHours / 8, 0),
    extraMinutes: 0,
    weeks: weeks.length,
    weeks48: weeks.filter((w) => w.nights > workingNights).length,
  };
  let estimatedDays = 0;
  for (const d of days) {
    const estimated = isEstimated(mondayOf(d));
    if (estimated) estimatedDays++;
    const { kind, extra } = kindOf(d, estimated);
    if (kind === "work") {
      stats.daysWorked++;
      stats.extraMinutes += extra;
    } else if (kind === "off") stats.daysOff++;
    else if (kind === "vacation") stats.vacationDays++;
    else if (kind === "sick") stats.sickDays++;
    else stats.absentDays++;
  }
  const lastSunday = weeks.at(-1)?.sunday;
  const tailDays = days.filter((d) => !lastSunday || d > lastSunday);
  const tail = tailDays.length
    ? {
        from: tailDays[0]!,
        to: tailDays.at(-1)!,
        nights: tailDays.filter((d) => kindOf(d, isEstimated(mondayOf(d))).kind === "work").length,
      }
    : null;
  return {
    from,
    to,
    weeks,
    tail,
    nights: stats.daysWorked,
    offs: stats.daysOff,
    away: stats.vacationDays + stats.sickDays + stats.absentDays,
    hours: stats.daysWorked * 8 + stats.extraMinutes / 60,
    extraHours: stats.offDaysWorked * 8 + stats.extraMinutes / 60,
    closingMinutes: stats.extraMinutes,
    estimatedDays,
    stats,
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
    weeks: auto.weeks,
    // Si se escriben a mano las fiestas trabajadas, cada una cuenta como una semana a 48 h.
    weeks48: o.offDaysWorked != null ? o.offDaysWorked : auto.weeks48,
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
/**
 * Tu contrato: 40 h = 5 noches por semana (2 libres). Es fijo para la nómina y NO depende de
 * Ajustes → Turno → "días libres por semana" (eso es para avisos de la plantilla): si allí pone 1,
 * las semanas de 6 noches siguen siendo semanas a 48 h con su plus.
 */
export const CONTRACT_NIGHTS = 5;
export const CONTRACT_DAYS_OFF = 7 - CONTRACT_NIGHTS;

/** Nocturnidad por hora (céntimos). */
export function nightPlusPerHourCents(cfg: PayrollConfig): number {
  return cfg.nightPlusMode === "PER_NIGHT"
    ? cfg.nightPlusPerNightCents / SHIFT_HOURS
    : (cfg.baseMonthlyCents * cfg.nightPlusPercent) / 100 / MONTHLY_HOURS;
}

/** Semanas por mes de media (52/12): un mes entero a 48 h son 8 h × 52/12 = 34,67 h más. */
export const WEEKS_PER_MONTH = 52 / 12;

/**
 * Lo que la empresa paga de más al mes por hacer 48 h/semana en vez de 40: "brut 48 h" − (base + resp. +
 * nocturnidad completa). Con la propuesta de 2026: 2.336,47 − 1.860,07 = 476,40 €. null si no hay dato.
 */
export function week48SupplementCents(cfg: PayrollConfig): number | null {
  if (!cfg.gross48Cents) return null;
  const night = cfg.nightPlusMode === "PERCENT" ? (cfg.baseMonthlyCents * cfg.nightPlusPercent) / 100 : 0;
  const s = cfg.gross48Cents - cfg.baseMonthlyCents - cfg.respPlusCents - night;
  return s > 0 ? s : null;
}

/** Precio de la hora extra (céntimos, sin redondear). */
export function overtimeRateCents(cfg: PayrollConfig, shift: ShiftKind): number {
  // Con el sueldo de 48 h de la empresa, su precio: plus de 48 h / (8 h × 52/12) (476,40 € → 13,74 €/h).
  const s48 = week48SupplementCents(cfg);
  if (s48 !== null) return s48 / (SHIFT_HOURS * WEEKS_PER_MONTH);
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
  const s48 = week48SupplementCents(cfg);
  let extraNights = stats.offDaysWorked;
  if (s48 !== null) {
    // Como la empresa: un mes entero a 48 h cobra el sueldo de 48 h; si solo algunas semanas, la parte proporcional.
    const weeks = stats.weeks && stats.weeks > 0 ? stats.weeks : WEEKS_PER_MONTH;
    const w48 = Math.min(stats.weeks48 ?? stats.offDaysWorked, stats.offDaysWorked, weeks);
    add(
      "week48",
      "Jornada 48 h",
      (s48 * f * w48) / weeks,
      w48 >= weeks ? "todo el mes" : `${w48} de ${Math.round(weeks * 100) / 100} semanas`,
    );
    extraNights -= w48;
  }
  add(
    "over40",
    s48 !== null ? "Horas extra (noches de más)" : "Horas extra (fiestas trabajadas)",
    (rate * extraNights * SHIFT_HOURS * 60) / 60,
    `${extraNights} × 8 h × ${formatEuros(round(rate))}`,
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
