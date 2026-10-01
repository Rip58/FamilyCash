"use client";

import { useState } from "react";
import { savePayrollSettings } from "@/app/actions/payroll";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { type NightPlusMode, type PayrollConfig, parseEuros } from "@/lib/payroll";
import { BackHeader, Field, inputClass, useRun } from "./kit";

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

export function PayrollSettingsForm({ initial, employees }: { initial: PayrollConfig; employees: { id: string; name: string }[] }) {
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
        <Card title="Salario">
          <Field label="Salario base mensual (bruto)">
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
          <Field label="Precio de la hora extra">
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
