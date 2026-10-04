"use client";

import { cn } from "@/components/ui/cn";
import { type DateStr, type MonthStr, formatDayMonth, formatMonth } from "@/lib/dates";
import {
  type ForecastWeek, type MonthOverrides, type PayForecast, type PayrollConfig, type PayrollPeriod, calculatePay, configForMonth,
  formatEuros, formatHours, mergeStats, overtimeRateCents,
} from "@/lib/payroll";

const STATE: Record<ForecastWeek["state"], { label: string; cls: string }> = {
  cerrada: { label: "Cerrada", cls: "text-muted" },
  "en-curso": { label: "En curso", cls: "text-accent" },
  planificada: { label: "Prevista", cls: "text-muted" },
  estimada: { label: "Sin planning", cls: "text-warning" },
};

/** "28 sep–4 oct" (sin repetir el mes si es el mismo). */
function range(a: DateStr, b: DateStr): string {
  const [da, db] = [formatDayMonth(a), formatDayMonth(b)];
  return a.slice(5, 7) === b.slice(5, 7) ? `${Number(a.slice(8))}–${db}` : `${da}–${db}`;
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center rounded-control px-1 py-2", accent ? "bg-accent/12" : "bg-surface-2")}>
      <span className={cn("text-[20px] font-bold leading-tight tabular-nums", accent && "text-accent")}>{value}</span>
      <span className="text-[11px] text-muted">{label}</span>
    </div>
  );
}

/**
 * Previsión de la nómina del mes en curso con el calendario de Semana: noches, fiestas, horas (40–48 h por semana),
 * horas extra y sueldo estimado. Sin nada que rellenar: si algo no cuadra se cambia en Semana.
 */
export function LiveMonth({
  month,
  forecast: f,
  overrides,
  config,
  periods,
  workingNights,
}: {
  month: MonthStr;
  forecast: PayForecast;
  overrides: MonthOverrides;
  config: PayrollConfig;
  periods: PayrollPeriod[];
  /** Noches de contrato por semana (5 = 40 h). */
  workingNights: number;
}) {
  const cfg = configForMonth(config, periods, month);
  const stats = mergeStats(f.stats, { contractDays: overrides.contractDays ?? null });
  const pay = calculatePay(cfg, stats, "NIGHT");
  const rate = overtimeRateCents(cfg, "NIGHT");
  const extraCents = Math.round(rate * f.extraHours);
  const contractHours = workingNights * 8;

  return (
    <section aria-label="Previsión de la nómina" className="overflow-hidden rounded-card bg-surface">
      <div className="px-4 pb-3 pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Nómina de {formatMonth(month).split(" ")[0]}</h2>
          <span className="text-[12px] tabular-nums text-muted">{range(f.from, f.to)}</span>
        </div>
        {cfg.baseMonthlyCents > 0 ? (
          <div className="mt-2 flex items-end justify-between gap-2">
            <span className="pb-0.5 text-[14px] leading-tight text-muted">
              Sueldo
              <br />
              estimado
            </span>
            <span className="text-right">
              <span className="block text-[30px] font-bold leading-none tabular-nums tracking-tight" data-testid="live-net">
                {formatEuros(pay.netCents)}
              </span>
              <span className="text-[12px] tabular-nums text-muted">neto · bruto {formatEuros(pay.grossCents)}</span>
            </span>
          </div>
        ) : (
          <p className="mt-2 text-[14px] text-muted">Pon tu sueldo en Ajustes → Nómina para ver el importe.</p>
        )}
        <div className="mt-3 grid grid-cols-4 gap-1.5" data-testid="live-totals">
          <Stat value={String(f.nights)} label="noches" />
          <Stat value={String(f.offs)} label="fiestas" />
          <Stat value={formatHours(f.hours * 60)} label="horas" />
          <Stat value={`+${formatHours(f.extraHours * 60)}`} label="h extra" accent={f.extraHours > 0} />
        </div>
        {f.away > 0 && (
          <p className="mt-1.5 text-[12px] text-muted">
            {f.away} {f.away === 1 ? "día" : "días"} de vacaciones, baja o faltas.
          </p>
        )}
      </div>

      <div className="border-t border-line px-4 py-2">
        <p className="pb-1 text-[12px] font-semibold uppercase tracking-wide text-muted">
          Semanas (lunes–domingo) · contrato {contractHours} h
        </p>
        <ul className="divide-y divide-line" aria-label="Semanas">
          {f.weeks.map((w) => (
            <li key={w.monday} className="flex min-h-11 items-center gap-2 text-[14px]">
              <span className="w-[88px] shrink-0 whitespace-nowrap text-[13px] tabular-nums">{range(w.monday, w.sunday)}</span>
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="whitespace-nowrap tabular-nums">
                  <b>{w.nights}</b> noches · {w.hours} h
                </span>
                {w.away > 0 && <span className="whitespace-nowrap text-[12px] text-muted">{w.away} vac./baja</span>}
              </span>
              <span className="w-[50px] shrink-0 text-center">
                {w.extraHours > 0 ? (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[12px] font-semibold tabular-nums text-accent">
                    +{w.extraHours} h
                  </span>
                ) : (
                  <span className="text-[12px] text-muted">—</span>
                )}
              </span>
              <span className={cn("w-[66px] shrink-0 whitespace-nowrap text-right text-[11px]", STATE[w.state].cls)}>
                {STATE[w.state].label}
              </span>
            </li>
          ))}
          {f.tail && (
            <li className="flex min-h-11 items-center gap-2 text-[13px] text-muted">
              <span className="w-[88px] shrink-0 whitespace-nowrap text-[13px] tabular-nums">{range(f.tail.from, f.tail.to)}</span>
              <span className="min-w-0 flex-1">
                {f.tail.nights} noches · su semana termina después: las horas extra van en la nómina siguiente
              </span>
            </li>
          )}
        </ul>
        {f.closingMinutes > 0 && (
          <p className="py-1 text-[13px]">
            Horas de cierre de turno (apuntadas en Hoy): <b className="tabular-nums">{formatHours(f.closingMinutes)} h</b>
          </p>
        )}
        {f.extraHours > 0 && cfg.baseMonthlyCents > 0 && (
          <p className="py-1 text-[13px]">
            Horas extra: <b className="tabular-nums">{formatHours(f.extraHours * 60)} h × {formatEuros(Math.round(rate))}</b> ≈{" "}
            <b className="tabular-nums text-accent">{formatEuros(extraCents)}</b>
          </p>
        )}
        {f.estimatedDays > 0 && (
          <p className="py-1 text-[12px] text-warning">
            Hay semanas sin planning: se cuentan como una semana normal ({workingNights} noches, {contractHours} h). Cuando
            las pongas en Semana, la previsión se ajusta sola.
          </p>
        )}
      </div>

      {cfg.baseMonthlyCents > 0 && (
        <details className="group border-t border-line">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-[14px] text-accent">
            Ver el cálculo
            <span className="text-muted transition-transform group-open:rotate-90" aria-hidden>
              ›
            </span>
          </summary>
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
            <li className="flex items-baseline justify-between gap-3 border-t border-line pt-1 font-semibold">
              <span>Bruto</span>
              <span className="tabular-nums">{formatEuros(pay.grossCents)}</span>
            </li>
            {pay.deductions.map((l) => (
              <li key={l.key} className="flex items-baseline justify-between gap-3 text-muted">
                <span>
                  {l.label} · {l.detail}
                </span>
                <span className="tabular-nums">−{formatEuros(l.cents)}</span>
              </li>
            ))}
            <li className="flex items-baseline justify-between gap-3 border-t border-line pt-1 font-semibold">
              <span>Neto</span>
              <span className="tabular-nums">{formatEuros(pay.netCents)}</span>
            </li>
          </ul>
        </details>
      )}
    </section>
  );
}
