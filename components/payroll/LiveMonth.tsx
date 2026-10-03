"use client";

import { useEffect, useState } from "react";
import { cn } from "@/components/ui/cn";
import { type MonthStr, formatDayMonth, formatMonth, payPeriodDays } from "@/lib/dates";
import {
  type MonthOverrides, type MonthProgress, type MonthStats, type PayrollConfig, type PayrollPeriod, calculatePay, configForMonth,
  formatEuros, formatHours, mergeStats, offDayOvertimeMinutes, overtimeRateCents, projectMonth,
} from "@/lib/payroll";

const CHIPS = [
  { key: "daysWorked", short: "T", label: "trabajadas" },
  { key: "daysOff", short: "F", label: "fiestas" },
  { key: "vacationDays", short: "V", label: "vacaciones" },
  { key: "sickDays", short: "B", label: "baja" },
  { key: "absentDays", short: "Fa", label: "faltas" },
] as const;

const stepBtn =
  "flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-[20px] font-medium text-accent active:opacity-70 disabled:opacity-30";

function Stepper({
  label,
  hint,
  value,
  display,
  onChange,
  min = 0,
  max,
  step = 1,
}: {
  label: string;
  hint?: string;
  value: number;
  display?: string;
  onChange: (v: number) => void;
  min?: number;
  max: number;
  step?: number;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-2">
      <span className="min-w-0">
        <span className="block text-[15px] leading-tight">{label}</span>
        {hint && <span className="block text-[12px] leading-tight text-muted">{hint}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1" role="group" aria-label={label}>
        <button type="button" aria-label={`Menos: ${label}`} className={stepBtn} disabled={value <= min} onClick={() => onChange(value - step)}>
          −
        </button>
        <span className="min-w-8 text-center text-[17px] font-semibold tabular-nums" aria-live="polite">
          {display ?? value}
        </span>
        <button type="button" aria-label={`Más: ${label}`} className={stepBtn} disabled={value >= max} onClick={() => onChange(value + step)}>
          +
        </button>
      </span>
    </div>
  );
}

function chipsOf(s: MonthStats) {
  return CHIPS.filter((c) => s[c.key] > 0);
}

/**
 * Nómina del mes en curso en tiempo real: lo apuntado en Hoy/Semana hasta hoy y, para los días que quedan,
 * el planning con las fiestas que estimes (cada fiesta de menos = una noche más = 8 h extra).
 */
export function LiveMonth({
  month,
  progress,
  overrides,
  config,
  periods,
}: {
  month: MonthStr;
  progress: MonthProgress;
  overrides: MonthOverrides;
  config: PayrollConfig;
  periods: PayrollPeriod[];
}) {
  const storeKey = `nomina:estimacion:${month}`;
  const [offLeft, setOffLeft] = useState(progress.plannedOffLeft);
  const [extraLeft, setExtraLeft] = useState(0);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey) ?? "null") as { off?: number; extra?: number; today?: string } | null;
      // Solo vale lo guardado el mismo día: al pasar el día, el planning manda otra vez.
      if (saved && saved.today === progress.today) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (typeof saved.off === "number") setOffLeft(saved.off);
        if (typeof saved.extra === "number") setExtraLeft(saved.extra);
      }
    } catch {
      /* almacenamiento no disponible */
    }
  }, [storeKey, progress.today]);
  const remember = (off: number, extra: number) => {
    try {
      localStorage.setItem(storeKey, JSON.stringify({ off, extra, today: progress.today }));
    } catch {
      /* ignorar */
    }
  };

  const cfg = configForMonth(config, periods, month);
  const maxOff = Math.max(progress.daysLeft - progress.awayLeft, 0);
  const projected = mergeStats(projectMonth(progress, offLeft, extraLeft), { contractDays: overrides.contractDays ?? null });
  const pay = calculatePay(cfg, projected, "NIGHT");
  const rate = overtimeRateCents(cfg, "NIGHT");
  const soFarExtra = offDayOvertimeMinutes(progress.soFar) + progress.soFar.extraMinutes;
  const monthExtra = offDayOvertimeMinutes(projected) + projected.extraMinutes;
  const day = progress.soFar.daysInMonth - progress.daysLeft;
  const period = payPeriodDays(month, config.cutoffDay);
  const changed = offLeft !== progress.plannedOffLeft || extraLeft !== 0;

  return (
    <section aria-label="Mes en curso" className="overflow-hidden rounded-card bg-surface">
      <div className="px-4 pb-2 pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Nómina {formatMonth(month)}</h2>
          <span className="text-[12px] tabular-nums text-muted">
            {formatDayMonth(period[0]!)} – {formatDayMonth(period.at(-1)!)} · día {day}/{progress.soFar.daysInMonth}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <div className="h-full rounded-full bg-accent" style={{ width: `${(day / progress.soFar.daysInMonth) * 100}%` }} />
        </div>
        {cfg.baseMonthlyCents > 0 ? (
          <p className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-[15px] text-muted">Neto previsto</span>
            <span className="text-[28px] font-bold tabular-nums tracking-tight" data-testid="live-net">
              ≈ {formatEuros(pay.netCents)}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-[14px] text-muted">Configura tu salario en Ajustes → Nómina para ver el importe.</p>
        )}
        {cfg.baseMonthlyCents > 0 && (
          <p className="text-right text-[12px] tabular-nums text-muted">Bruto ≈ {formatEuros(pay.grossCents)}</p>
        )}
      </div>

      <div className="border-t border-line px-4 py-2">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Hasta hoy (Semana y Hoy)</p>
        <p className="mt-1 flex flex-wrap items-center gap-1" data-testid="live-sofar">
          {chipsOf(progress.soFar).map((c) => (
            <span
              key={c.key}
              aria-label={`${progress.soFar[c.key]} ${c.label}`}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-2 px-2 text-[13px] font-semibold tabular-nums"
            >
              {progress.soFar[c.key]}
              <span className="font-medium text-muted">{c.short}</span>
            </span>
          ))}
          <span
            className={cn(
              "inline-flex h-7 items-center rounded-full px-2 text-[13px] font-semibold tabular-nums",
              soFarExtra > 0 ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted",
            )}
          >
            {formatHours(soFarExtra)} h extra
            {soFarExtra > 0 && cfg.baseMonthlyCents > 0 && (
              <span className="ml-1 font-medium">≈ {formatEuros(Math.round((rate * soFarExtra) / 60))}</span>
            )}
          </span>
        </p>
        {progress.soFar.offDaysWorked > 0 && (
          <p className="mt-1 text-[12px] text-muted">
            {progress.soFar.offDaysWorked} fiesta{progress.soFar.offDaysWorked === 1 ? "" : "s"} trabajada
            {progress.soFar.offDaysWorked === 1 ? "" : "s"} (+8 h cada una) en semanas ya cerradas.
          </p>
        )}
      </div>

      {progress.daysLeft > 0 && (
        <div className="border-t border-line px-4 py-1">
          <Stepper
            label={`Fiestas en los ${progress.daysLeft} días hasta el cierre`}
            hint={`Planning: ${progress.plannedOffLeft}${progress.awayLeft > 0 ? ` · ${progress.awayLeft} de vacaciones/baja` : ""} · 1 menos = +8 h extra`}
            value={offLeft}
            max={maxOff}
            onChange={(v) => {
              setOffLeft(v);
              remember(v, extraLeft);
            }}
          />
          <Stepper
            label="Horas de cierre que prevés"
            hint={`Horas extra al cerrar el turno, de aquí al ${formatDayMonth(period.at(-1)!)}`}
            value={extraLeft}
            display={formatHours(extraLeft)}
            step={60}
            max={60 * 60}
            onChange={(v) => {
              setExtraLeft(v);
              remember(offLeft, v);
            }}
          />
          {changed && (
            <button
              type="button"
              onClick={() => {
                setOffLeft(progress.plannedOffLeft);
                setExtraLeft(0);
                remember(progress.plannedOffLeft, 0);
              }}
              className="min-h-11 text-[14px] font-medium text-accent"
            >
              Volver al planning
            </button>
          )}
        </div>
      )}

      <details className="group border-t border-line">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-[14px]">
          <span>
            Mes previsto: <b className="tabular-nums">{projected.daysWorked}</b> noches ·{" "}
            <b className="tabular-nums">{formatHours(monthExtra)} h</b> extra
          </span>
          <span className="text-muted transition-transform group-open:rotate-90" aria-hidden>
            ›
          </span>
        </summary>
        {cfg.baseMonthlyCents > 0 && (
          <ul className="space-y-1 px-4 pb-3 text-[14px]">
            {pay.earnings.map((l) => (
              <li key={l.key} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0">
                  {l.label}
                  {l.detail && <span className="text-[12px] text-muted"> · {l.detail}</span>}
                </span>
                <span className={cn("shrink-0 tabular-nums", l.cents < 0 && "text-danger")}>{formatEuros(l.cents)}</span>
              </li>
            ))}
            {pay.deductions.map((l) => (
              <li key={l.key} className="flex items-baseline justify-between gap-3 text-muted">
                <span>
                  {l.label} · {l.detail}
                </span>
                <span className="tabular-nums">−{formatEuros(l.cents)}</span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  );
}
