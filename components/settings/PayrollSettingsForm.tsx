"use client";

import { useState } from "react";
import { deletePayrollPeriod, savePayrollPeriod, savePayrollSettings } from "@/app/actions/payroll";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { type NightPlusMode, type PayrollConfig, type PayrollPeriod, formatDateEs, formatEuros, parseEuros } from "@/lib/payroll";
import { AddButton, BackHeader, ConfirmButton, Field, PrimaryButton, inputClass, useRun } from "./kit";

const toText = (cents: number) => (cents ? (cents / 100).toFixed(2).replace(".", ",") : "");

function EuroInput({ label, cents, onCommit }: { label: string; cents: number; onCommit: (cents: number) => void }) {
  const [text, setText] = useState(toText(cents));
  const [bad, setBad] = useState(false);
  return (
    <div className="relative">
      <input
        inputMode="decimal"
        aria-label={label}
        aria-invalid={bad}
        value={text}
        placeholder="0,00"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const v = parseEuros(text);
          setBad(v === null || v < 0);
          if (v !== null && v >= 0 && v !== cents) onCommit(v);
        }}
        className={`${inputClass} pr-9 ${bad ? "ring-2 ring-danger" : ""}`}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">€</span>
    </div>
  );
}

function PercentInput({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value).replace(".", ","));
  return (
    <div className="relative">
      <input
        inputMode="decimal"
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const v = Number(text.replace(",", "."));
          if (Number.isFinite(v) && v >= 0 && v <= 100 && v !== value) onCommit(v);
        }}
        className={`${inputClass} pr-9`}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">%</span>
    </div>
  );
}

type PeriodDraft = Omit<PayrollPeriod, "id"> & { id?: string };

function PeriodEditor({ initial, onDone }: { initial: PeriodDraft; onDone: () => void }) {
  const [p, setP] = useState(initial);
  const { pending, run } = useRun();
  return (
    <div className="pb-2">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Desde">
          <input type="date" aria-label="Desde" value={p.from} onChange={(e) => setP({ ...p, from: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Hasta" hint="Vacío = indefinido">
          <input type="date" aria-label="Hasta" value={p.to ?? ""} onChange={(e) => setP({ ...p, to: e.target.value || null })} className={inputClass} />
        </Field>
      </div>
      <Field label="Salario bruto mensual (jornada base)">
        <EuroInput label="Salario bruto del periodo" cents={p.baseCents} onCommit={(v) => setP((x) => ({ ...x, baseCents: v }))} />
      </Field>
      <Field label="Plus de responsabilidad">
        <EuroInput label="Plus de responsabilidad" cents={p.respPlusCents} onCommit={(v) => setP((x) => ({ ...x, respPlusCents: v }))} />
      </Field>
      <PrimaryButton
        className="mt-2 w-full"
        disabled={pending || !p.from}
        onClick={() => run(() => savePayrollPeriod(p), { msg: "Periodo guardado", onDone })}
      >
        Guardar periodo
      </PrimaryButton>
      {p.id && (
        <div className="mt-2">
          <ConfirmButton label="Borrar periodo" onConfirm={() => run(() => deletePayrollPeriod(p.id!), { msg: "Periodo borrado", onDone })} />
        </div>
      )}
    </div>
  );
}

function Periods({ periods }: { periods: PayrollPeriod[] }) {
  const [editing, setEditing] = useState<{ draft: PeriodDraft; open: boolean; n: number } | null>(null);
  const last = periods.at(-1);
  return (
    <Card title="Salario por periodos" action={<AddButton label="Periodo" onClick={() => setEditing((e) => ({ draft: { from: "", to: null, baseCents: last?.baseCents ?? 0, respPlusCents: 0 }, open: true, n: (e?.n ?? 0) + 1 }))} />} flush>
      {periods.length === 0 ? (
        <p className="px-4 pb-3 text-[14px] text-muted">Sin periodos: se usa el salario base de abajo.</p>
      ) : (
        <ul>
          {periods.map((p) => (
            <li key={p.id} className="border-t border-line first:border-t-0">
              <button
                type="button"
                onClick={() => setEditing((e) => ({ draft: p, open: true, n: (e?.n ?? 0) + 1 }))}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">
                    {formatDateEs(p.from)} – {p.to ? formatDateEs(p.to) : "Indefinido"}
                  </span>
                  <span className="block text-[13px] text-muted">
                    {formatEuros(p.baseCents)}
                    {p.respPlusCents > 0 && ` + resp. ${formatEuros(p.respPlusCents)}`}
                  </span>
                </span>
                <span aria-hidden className="text-muted">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <BottomSheet open={!!editing?.open} onClose={() => setEditing((e) => (e ? { ...e, open: false } : e))} title={editing?.draft.id ? "Editar periodo" : "Nuevo periodo"}>
        {editing && <PeriodEditor key={editing.n} initial={editing.draft} onDone={() => setEditing((e) => (e ? { ...e, open: false } : e))} />}
      </BottomSheet>
    </Card>
  );
}

export function PayrollSettingsForm({
  initial,
  periods,
  employees,
}: {
  initial: PayrollConfig;
  periods: PayrollPeriod[];
  employees: { id: string; name: string }[];
}) {
  const [cfg, setCfg] = useState(initial);
  const { run } = useRun();
  const save = (patch: Partial<PayrollConfig>) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    run(() => savePayrollSettings(next));
  };

  return (
    <div>
      <BackHeader title="Nómina" />
      <div className="flex flex-col gap-4">
        <Card title="¿Quién eres?">
          <Field label="Empleado" hint="Los meses de la nómina se rellenan con lo apuntado para esta persona en Hoy y Semana.">
            <select
              aria-label="Empleado"
              value={cfg.employeeId ?? ""}
              onChange={(e) => save({ employeeId: e.target.value || null })}
              className={inputClass}
            >
              <option value="">— Ninguno —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
        </Card>
        <Periods periods={periods} />
        <Card title="Salario">
          <Field label="Salario base mensual (bruto)" hint="Solo para meses sin periodo de salario.">
            <EuroInput label="Salario base mensual" cents={cfg.baseMonthlyCents} onCommit={(v) => save({ baseMonthlyCents: v })} />
          </Field>
          <Field label="Prorrata de pagas extra (al mes)" hint="Déjalo vacío si cobras las pagas aparte.">
            <EuroInput label="Prorrata de pagas extra" cents={cfg.proratedExtraCents} onCommit={(v) => save({ proratedExtraCents: v })} />
          </Field>
        </Card>
        <Card title="Plus de nocturnidad">
          <Segmented<NightPlusMode>
            aria-label="Tipo de plus"
            value={cfg.nightPlusMode}
            onChange={(m) => save({ nightPlusMode: m })}
            options={[
              { value: "PERCENT", label: "% del base" },
              { value: "PER_NIGHT", label: "€ por noche" },
            ]}
          />
          {cfg.nightPlusMode === "PERCENT" ? (
            <Field label="Porcentaje sobre el salario base" hint="Se aplica en proporción a las noches trabajadas.">
              <PercentInput label="Porcentaje de nocturnidad" value={cfg.nightPlusPercent} onCommit={(v) => save({ nightPlusPercent: v })} />
            </Field>
          ) : (
            <Field label="Importe por noche trabajada">
              <EuroInput label="Plus por noche" cents={cfg.nightPlusPerNightCents} onCommit={(v) => save({ nightPlusPerNightCents: v })} />
            </Field>
          )}
        </Card>
        <Card title="Extras">
          <Field label="Precio de la hora extra" hint="Jornada 48 h = 8 h extra a la semana (≈ 34,67 h al mes).">
            <EuroInput label="Precio hora extra" cents={cfg.overtimeHourCents} onCommit={(v) => save({ overtimeHourCents: v })} />
          </Field>
          <Field label="Plus por festivo trabajado (por día)">
            <EuroInput label="Plus festivo trabajado" cents={cfg.holidayWorkedCents} onCommit={(v) => save({ holidayWorkedCents: v })} />
          </Field>
        </Card>
        <Card title="Retenciones">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Seguridad Social">
              <PercentInput label="Seguridad Social" value={cfg.ssPercent} onCommit={(v) => save({ ssPercent: v })} />
            </Field>
            <Field label="IRPF">
              <PercentInput label="IRPF" value={cfg.irpfPercent} onCommit={(v) => save({ irpfPercent: v })} />
            </Field>
          </div>
        </Card>
      </div>
    </div>
  );
}
