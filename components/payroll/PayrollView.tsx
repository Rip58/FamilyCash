"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { savePayslip } from "@/app/actions/payroll";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/components/ui/cn";
import { type MonthStr, formatMonth } from "@/lib/dates";
import {
  type MonthStats, type PayrollConfig, type ShiftKind, calculatePay, formatEuros, formatHours, parseEuros,
} from "@/lib/payroll";
import type { PayrollMonth } from "@/lib/payroll-queries";

type View = "registro" | "calculadora";

const COUNT_FIELDS = [
  { key: "daysWorked", label: "Días trabajados", short: "T" },
  { key: "daysOff", label: "Días de fiesta", short: "F" },
  { key: "vacationDays", label: "Vacaciones", short: "V" },
  { key: "sickDays", label: "Baja", short: "B" },
  { key: "absentDays", label: "Faltas", short: "Fa" },
  { key: "holidaysWorked", label: "Festivos trabajados", short: "Fe" },
] as const;
type CountKey = (typeof COUNT_FIELDS)[number]["key"];

const inputClass =
  "min-h-11 w-full rounded-control bg-surface-2 px-3 text-[17px] outline-none focus-visible:ring-2 focus-visible:ring-accent";

function statsLine(s: MonthStats): string {
  const parts = COUNT_FIELDS.filter((f) => s[f.key] > 0).map((f) => `${s[f.key]}${f.short}`);
  if (s.extraMinutes > 0) parts.push(`${formatHours(s.extraMinutes)}X`);
  return parts.join(" · ") || "Sin datos";
}

// ---------------------------------------------------------------- Registro

function MonthEditor({ m, onDone }: { m: PayrollMonth; onDone: () => void }) {
  const [counts, setCounts] = useState<Record<CountKey, string>>(() =>
    Object.fromEntries(COUNT_FIELDS.map((f) => [f.key, m.overrides[f.key]?.toString() ?? ""])) as Record<CountKey, string>,
  );
  const [extra, setExtra] = useState(m.overrides.extraMinutes != null ? formatHours(m.overrides.extraMinutes) : "");
  const [gross, setGross] = useState(m.grossCents != null ? (m.grossCents / 100).toFixed(2).replace(".", ",") : "");
  const [net, setNet] = useState(m.netCents != null ? (m.netCents / 100).toFixed(2).replace(".", ",") : "");
  const [note, setNote] = useState(m.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toInt = (v: string) => (v.trim() === "" ? null : Number.parseInt(v, 10));
  const toEuros = (v: string) => (v.trim() === "" ? null : parseEuros(v));

  function save(reset = false) {
    const hours = extra.trim() === "" ? null : Number(extra.replace(",", "."));
    const grossCents = toEuros(gross);
    const netCents = toEuros(net);
    if (!reset && ((hours !== null && Number.isNaN(hours)) || (gross.trim() && grossCents === null) || (net.trim() && netCents === null))) {
      setError("Revisa los números.");
      return;
    }
    start(async () => {
      const r = await savePayslip(
        reset
          ? { month: m.month, daysWorked: null, daysOff: null, vacationDays: null, sickDays: null, absentDays: null, holidaysWorked: null, extraMinutes: null, grossCents: null, netCents: null, note: null }
          : {
              month: m.month,
              ...(Object.fromEntries(COUNT_FIELDS.map((f) => [f.key, toInt(counts[f.key])])) as Record<CountKey, number | null>),
              extraMinutes: hours === null ? null : Math.round(hours * 60),
              grossCents,
              netCents,
              note,
            },
      );
      if (r.ok) onDone();
      else setError(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-3 pb-2">
      <p className="text-[13px] text-muted">Vacío = automático (lo apuntado en Hoy/Semana). Escribe un número para corregirlo.</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {COUNT_FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-[13px] text-muted">{f.label}</span>
            <input
              inputMode="numeric"
              aria-label={f.label}
              value={counts[f.key]}
              placeholder={String(m.auto[f.key])}
              onChange={(e) => setCounts((c) => ({ ...c, [f.key]: e.target.value.replace(/\D/g, "").slice(0, 2) }))}
              className={inputClass}
            />
          </label>
        ))}
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-muted">Horas extra</span>
          <input
            inputMode="decimal"
            aria-label="Horas extra"
            value={extra}
            placeholder={formatHours(m.auto.extraMinutes)}
            onChange={(e) => setExtra(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-muted">Bruto real (€)</span>
          <input inputMode="decimal" aria-label="Bruto real" value={gross} onChange={(e) => setGross(e.target.value)} placeholder="0,00" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-muted">Neto real (€)</span>
          <input inputMode="decimal" aria-label="Neto real" value={net} onChange={(e) => setNet(e.target.value)} placeholder="0,00" className={inputClass} />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[13px] text-muted">Nota</span>
        <input aria-label="Nota" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: atrasos, plus, error en nómina…" className={inputClass} />
      </label>
      {error && <p role="alert" className="text-[14px] text-danger">{error}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={() => save()}
        className="min-h-11 rounded-control bg-accent text-[16px] font-semibold text-accent-fg disabled:opacity-40"
      >
        Guardar
      </button>
      <button type="button" disabled={pending} onClick={() => save(true)} className="min-h-11 text-[15px] font-medium text-danger">
        Volver a automático
      </button>
    </div>
  );
}

function Registry({ months, config, onCalc }: { months: PayrollMonth[]; config: PayrollConfig; onCalc: (m: MonthStr) => void }) {
  const [editing, setEditing] = useState<{ month: MonthStr; open: boolean } | null>(null);
  const current = editing ? months.find((m) => m.month === editing.month) : undefined;
  const canEstimate = config.baseMonthlyCents > 0;
  return (
    <div className="flex flex-col gap-2">
      {months.map((m) => {
        const estimate = canEstimate ? calculatePay(config, m.stats, "NIGHT").netCents : null;
        return (
          <div key={m.month} className="flex items-stretch overflow-hidden rounded-card bg-surface">
            <button
              type="button"
              onClick={() => setEditing({ month: m.month, open: true })}
              className="flex min-h-14 min-w-0 flex-1 flex-col justify-center px-4 py-2 text-left active:bg-surface-2"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[16px] font-semibold">{formatMonth(m.month)}</span>
                {m.netCents != null ? (
                  <span className="text-[16px] font-semibold tabular-nums">{formatEuros(m.netCents)}</span>
                ) : estimate != null ? (
                  <span className="text-[15px] tabular-nums text-muted">≈ {formatEuros(estimate)}</span>
                ) : null}
              </span>
              <span className="truncate text-[13px] text-muted">{statsLine(m.stats)}</span>
              {m.note && <span className="truncate text-[13px] text-muted">💬 {m.note}</span>}
            </button>
            <button
              type="button"
              onClick={() => onCalc(m.month)}
              aria-label={`Calcular ${formatMonth(m.month)}`}
              className="flex w-12 shrink-0 items-center justify-center border-l border-line text-[18px] text-accent active:bg-surface-2"
            >
              🧮
            </button>
          </div>
        );
      })}
      <p className="px-1 pt-1 text-[12px] text-muted">
        Importe en negrita = neto real que has apuntado; ≈ = estimación de la calculadora (turno de noche).
      </p>
      <BottomSheet
        open={!!editing?.open}
        onClose={() => setEditing((e) => (e ? { ...e, open: false } : e))}
        title={current ? formatMonth(current.month) : "Mes"}
      >
        {current && editing?.open && (
          <MonthEditor key={current.month} m={current} onDone={() => setEditing((e) => (e ? { ...e, open: false } : e))} />
        )}
      </BottomSheet>
    </div>
  );
}

// ---------------------------------------------------------------- Calculadora

function Counter({ label, value, onChange, max }: { label: string; value: number; onChange: (v: number) => void; max: number }) {
  const btn = "min-h-11 min-w-11 rounded-control bg-surface-2 text-[22px] font-medium text-accent disabled:opacity-30";
  return (
    <div className="flex min-h-12 items-center justify-between gap-3">
      <span className="text-[16px]">{label}</span>
      <div className="flex items-center gap-2" role="group" aria-label={label}>
        <button type="button" aria-label={`Menos ${label}`} className={btn} disabled={value <= 0} onClick={() => onChange(value - 1)}>
          −
        </button>
        <span className="min-w-9 text-center text-[18px] font-semibold tabular-nums">{value}</span>
        <button type="button" aria-label={`Más ${label}`} className={btn} disabled={value >= max} onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
    </div>
  );
}

function Calculator({ months, config, month, setMonth }: { months: PayrollMonth[]; config: PayrollConfig; month: MonthStr; setMonth: (m: MonthStr) => void }) {
  const data = months.find((m) => m.month === month) ?? months[0]!;
  return <CalculatorBody key={data.month} data={data} months={months} config={config} setMonth={setMonth} />;
}

function CalculatorBody({ data, months, config, setMonth }: { data: PayrollMonth; months: PayrollMonth[]; config: PayrollConfig; setMonth: (m: MonthStr) => void }) {
  const [shift, setShift] = useState<ShiftKind>("NIGHT");
  const [s, setS] = useState(data.stats);
  const others = s.daysOff + s.vacationDays + s.sickDays + s.absentDays;
  const stats: MonthStats = { ...s, daysWorked: Math.max(s.daysInMonth - others, 0) };
  const result = calculatePay(config, stats, shift);
  const set = (k: keyof MonthStats) => (v: number) => setS((x) => ({ ...x, [k]: v }));
  const maxOf = (k: keyof MonthStats) => Math.max(s.daysInMonth - others + s[k], 0);

  return (
    <div className="flex flex-col gap-3">
      <select
        aria-label="Mes"
        value={data.month}
        onChange={(e) => setMonth(e.target.value)}
        className="min-h-11 rounded-control bg-surface px-3 text-[17px] font-semibold"
      >
        {months.map((m) => (
          <option key={m.month} value={m.month}>
            {formatMonth(m.month)}
          </option>
        ))}
      </select>
      <Segmented
        aria-label="Turno"
        value={shift}
        onChange={setShift}
        options={[
          { value: "NIGHT", label: "🌙 Noche" },
          { value: "DAY", label: "☀️ Día" },
        ]}
      />
      {config.baseMonthlyCents === 0 && (
        <p className="rounded-control bg-warning/20 px-3 py-2 text-[14px] text-[#92600a] dark:text-warning">
          Configura tu salario y pluses en{" "}
          <Link href="/ajustes/nomina" className="font-semibold underline">
            Ajustes → Nómina
          </Link>
          .
        </p>
      )}
      <Card title={`${stats.daysWorked} ${shift === "NIGHT" ? "noches trabajadas" : "días trabajados"} de ${s.daysInMonth}`}>
        <div className="divide-y divide-line">
          <Counter label="Días de fiesta" value={s.daysOff} onChange={set("daysOff")} max={maxOf("daysOff")} />
          <Counter label="Vacaciones" value={s.vacationDays} onChange={set("vacationDays")} max={maxOf("vacationDays")} />
          <Counter label="Baja" value={s.sickDays} onChange={set("sickDays")} max={maxOf("sickDays")} />
          <Counter label="Faltas" value={s.absentDays} onChange={set("absentDays")} max={maxOf("absentDays")} />
          <Counter label="Festivos trabajados" value={s.holidaysWorked} onChange={set("holidaysWorked")} max={stats.daysWorked} />
          <div className="flex min-h-12 items-center justify-between gap-3">
            <span className="text-[16px]">Horas extra</span>
            <div className="flex items-center gap-2" role="group" aria-label="Horas extra">
              <button
                type="button"
                aria-label="Quitar 1 hora"
                disabled={s.extraMinutes <= 0}
                onClick={() => setS((x) => ({ ...x, extraMinutes: Math.max(x.extraMinutes - 60, 0) }))}
                className="min-h-11 min-w-11 rounded-control bg-surface-2 text-[22px] font-medium text-accent disabled:opacity-30"
              >
                −
              </button>
              <span className="min-w-9 text-center text-[18px] font-semibold tabular-nums">{formatHours(s.extraMinutes)}</span>
              <button
                type="button"
                aria-label="Añadir 1 hora"
                onClick={() => setS((x) => ({ ...x, extraMinutes: x.extraMinutes + 60 }))}
                className="min-h-11 min-w-11 rounded-control bg-surface-2 text-[22px] font-medium text-accent"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Resultado (estimación)">
        <ul className="space-y-1.5 text-[15px]">
          {result.earnings.map((l) => (
            <li key={l.key} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0">
                {l.label}
                {l.detail && <span className="text-[13px] text-muted"> · {l.detail}</span>}
              </span>
              <span className={cn("shrink-0 tabular-nums", l.cents < 0 && "text-danger")}>{formatEuros(l.cents)}</span>
            </li>
          ))}
          <li className="flex items-baseline justify-between gap-3 border-t border-line pt-1.5 font-semibold">
            <span>Bruto</span>
            <span className="tabular-nums">{formatEuros(result.grossCents)}</span>
          </li>
          {result.deductions.map((l) => (
            <li key={l.key} className="flex items-baseline justify-between gap-3 text-muted">
              <span>
                {l.label} · {l.detail}
              </span>
              <span className="tabular-nums">−{formatEuros(l.cents)}</span>
            </li>
          ))}
          <li className="flex items-baseline justify-between gap-3 border-t border-line pt-2 text-[20px] font-bold">
            <span>Neto</span>
            <span className="tabular-nums" data-testid="net">
              {formatEuros(result.netCents)}
            </span>
          </li>
        </ul>
        {data.netCents != null && (
          <p className="mt-2 text-[13px] text-muted">Neto real apuntado ese mes: {formatEuros(data.netCents)}</p>
        )}
      </Card>
      <p className="px-1 text-[12px] text-muted">
        Cálculo orientativo con tus importes de Ajustes; la nómina oficial puede variar (bajas, atrasos, IRPF regularizado…).
      </p>
    </div>
  );
}

export function PayrollView({
  months,
  config,
  employeeName,
  initialView,
}: {
  months: PayrollMonth[];
  config: PayrollConfig;
  employeeName: string | null;
  initialView: View;
}) {
  const [view, setView] = useState<View>(initialView);
  const [calcMonth, setCalcMonth] = useState<MonthStr>(months[0]!.month);
  return (
    <div className="flex flex-col gap-3 pb-6 pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-[28px] font-bold tracking-tight">Nómina</h1>
        <Link href="/ajustes/nomina" className="min-h-11 px-1 py-2 text-[15px] font-medium text-accent">
          Importes
        </Link>
      </div>
      {!employeeName && (
        <p className="rounded-control bg-surface px-3 py-2 text-[14px] text-muted">
          Elige quién eres en{" "}
          <Link href="/ajustes/nomina" className="font-semibold text-accent">
            Ajustes → Nómina
          </Link>{" "}
          para rellenar los meses con lo apuntado en Hoy y Semana.
        </p>
      )}
      <Segmented
        aria-label="Vista"
        value={view}
        onChange={setView}
        options={[
          { value: "registro", label: "Registro" },
          { value: "calculadora", label: "Calculadora" },
        ]}
      />
      {view === "registro" ? (
        <Registry
          months={months}
          config={config}
          onCalc={(m) => {
            setCalcMonth(m);
            setView("calculadora");
          }}
        />
      ) : (
        <Calculator months={months} config={config} month={calcMonth} setMonth={setCalcMonth} />
      )}
    </div>
  );
}
