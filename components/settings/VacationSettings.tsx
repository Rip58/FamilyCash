"use client";

import { useState } from "react";
import { deleteVacationWeek, saveVacationCampaign, saveVacationWeek } from "@/app/actions/vacations";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import type { DateStr } from "@/lib/dates";
import { type VacationCampaignView, type VacationWeekView, weekLabel } from "@/lib/vacations";
import { BackHeader, ConfirmButton, Field, PrimaryButton, Stepper, Toggle, inputClass, useRun } from "./kit";

type Dept = { id: string; name: string; color: string | null; secondary: boolean };
type PinRow = { id: string; name: string; pin: string };

/**
 * Ajustes → Vacaciones: reglas de la campaña (días, plazo, abierta), máximo a la vez por departamento, semanas
 * bloqueadas o con otro máximo (temporada) y el PIN fijo de cada empleado.
 */
export function VacationSettings({
  campaign,
  weeks,
  departments,
  pins,
  pageReady,
}: {
  campaign: VacationCampaignView;
  weeks: VacationWeekView[];
  departments: Dept[];
  pins: PinRow[];
  pageReady: boolean;
}) {
  return (
    <div>
      <BackHeader title={`Vacaciones ${campaign.year}`} />
      <div className="flex flex-col gap-4">
        <CampaignCard campaign={campaign} departments={departments} />
        <WeeksCard weeks={weeks} year={campaign.year} />
        <PinsCard pins={pins} pageReady={pageReady} />
      </div>
    </div>
  );
}

function CampaignCard({ campaign, departments }: { campaign: VacationCampaignView; departments: Dept[] }) {
  const { pending, run } = useRun();
  const [workDays, setWorkDays] = useState(campaign.workDays);
  const [deadline, setDeadline] = useState<string>(campaign.deadline);
  const [open, setOpen] = useState(campaign.open);
  const [defaultMax, setDefaultMax] = useState(campaign.defaultMax);
  const [deptMax, setDeptMax] = useState<Record<string, number>>(campaign.departmentMax);
  const counted = departments.filter((d) => !d.secondary);
  const changed =
    workDays !== campaign.workDays ||
    deadline !== campaign.deadline ||
    open !== campaign.open ||
    defaultMax !== campaign.defaultMax ||
    JSON.stringify(deptMax) !== JSON.stringify(campaign.departmentMax);

  // Un departamento con el mismo máximo que «los demás» no se guarda aparte: sigue al general si cambia.
  const setDept = (id: string, n: number) =>
    setDeptMax((m) => {
      const next = { ...m };
      if (n === defaultMax) delete next[id];
      else next[id] = n;
      return next;
    });

  return (
    <>
      <Card title={`Campaña ${campaign.year}`}>
        <div className="flex flex-col gap-4">
          <Field label="Días laborables por persona" hint="Cada semana entera descuenta 5; sus 2 días de fiesta no cuentan.">
            <Stepper label="Días laborables" value={workDays} min={1} max={60} onChange={setWorkDays} />
          </Field>
          <Field label="Plazo para elegir" hint="Último día en que los empleados pueden cambiar sus fechas.">
            <input
              id="vacation-deadline"
              aria-label="Plazo para elegir"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Toggle label="Abierta a los empleados" checked={open} onChange={setOpen} />
          <p className="-mt-2 text-[13px] text-muted">Al cerrarla ya no pueden cambiar nada.</p>
        </div>
      </Card>

      <Card title="Máximo a la vez">
        <p className="mb-3 text-[14px] text-muted">
          Cuántas personas de un mismo departamento pueden estar de vacaciones el mismo día. Por temporada se cambia en
          semanas concretas (abajo).
        </p>
        <ul className="flex flex-col divide-y divide-line">
          {counted.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-[16px]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color ?? "#64748b" }} />
                <span className="truncate">{d.name}</span>
              </span>
              <Stepper label={`Máximo en ${d.name}`} value={deptMax[d.id] ?? defaultMax} min={0} max={30} onChange={(n) => setDept(d.id, n)} />
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 py-2">
            <span className="text-[16px] font-medium">Los demás y sin departamento</span>
            <Stepper label="Máximo en los demás" value={defaultMax} min={0} max={30} onChange={setDefaultMax} />
          </li>
        </ul>
        {departments.some((d) => d.secondary) && (
          <p className="mt-2 text-[13px] text-muted">
            {departments.filter((d) => d.secondary).map((d) => d.name).join(", ")}: no cuentan (son tareas de todos).
          </p>
        )}
      </Card>

      <PrimaryButton
        type="button"
        disabled={!changed || pending || !deadline}
        onClick={() =>
          run(() => saveVacationCampaign({ year: campaign.year, workDays, deadline, open, defaultMax, departmentMax: deptMax }), {
            msg: "Reglas guardadas",
          })
        }
      >
        Guardar reglas
      </PrimaryButton>
    </>
  );
}

function WeeksCard({ weeks, year }: { weeks: VacationWeekView[]; year: number }) {
  const { pending, run } = useRun();
  const empty = { date: "", blocked: true, reason: "", custom: false, max: 1 };
  const [form, setForm] = useState(empty);
  const editing = weeks.find((w) => w.weekStart === form.date);

  const edit = (w: VacationWeekView) =>
    setForm({ date: w.weekStart, blocked: w.blocked, reason: w.reason ?? "", custom: w.maxOverride != null, max: w.maxOverride ?? 1 });

  const save = () =>
    run(
      () =>
        saveVacationWeek({
          date: form.date,
          blocked: form.blocked,
          reason: form.blocked ? form.reason : null,
          maxOverride: !form.blocked && form.custom ? form.max : null,
        }),
      { msg: form.blocked ? "Semana bloqueada" : "Semana guardada", onDone: () => setForm(empty) },
    );

  return (
    <Card title="Semanas con regla propia">
      <p className="mb-3 text-[14px] text-muted">
        Bloquea las semanas de mucho trabajo (los empleados las ven rayadas y no las pueden elegir) o cambia el máximo
        solo esa semana.
      </p>
      {weeks.length > 0 && (
        <ul className="mb-4 flex flex-col gap-1.5" aria-label="Semanas guardadas">
          {weeks.map((w) => (
            <li key={w.weekStart}>
              <button
                type="button"
                onClick={() => edit(w)}
                className={cn(
                  "flex min-h-12 w-full items-center justify-between gap-3 rounded-control bg-surface-2 px-3 py-2 text-left",
                  form.date === w.weekStart && "ring-2 ring-accent",
                )}
              >
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium tabular-nums">{weekLabel(w.weekStart)}</span>
                  {w.reason && <span className="block truncate text-[13px] text-muted">{w.reason}</span>}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold",
                    w.blocked ? "bg-danger/12 text-danger" : "bg-accent/12 text-accent",
                  )}
                >
                  {w.blocked ? "Bloqueada" : `Máx. ${w.maxOverride}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3 rounded-control border border-line p-3">
        <Field label={editing ? "Cambiar semana" : "Añadir semana"} hint="Elige cualquier día: se guarda la semana entera (lunes a domingo).">
          <input
            id="vacation-week-date"
            aria-label="Día de la semana"
            type="date"
            min={`${year - 1}-12-28`}
            max={`${year}-12-31`}
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            className={inputClass}
          />
        </Field>
        {form.date && <p className="-mt-1 text-[14px] font-medium tabular-nums">{weekLabel(mondayOfInput(form.date))}</p>}
        <Toggle label="No se pueden pedir vacaciones" checked={form.blocked} onChange={(v) => setForm((f) => ({ ...f, blocked: v }))} />
        {form.blocked ? (
          <Field label="Motivo (lo ven los empleados)">
            <input
              id="vacation-week-reason"
              aria-label="Motivo"
              value={form.reason}
              maxLength={80}
              placeholder="Ej.: Inventario"
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              className={inputClass}
            />
          </Field>
        ) : (
          <>
            <Toggle label="Otro máximo esta semana" checked={form.custom} onChange={(v) => setForm((f) => ({ ...f, custom: v }))} />
            {form.custom && (
              <Field label="Máximo a la vez (todos los departamentos)">
                <Stepper label="Máximo esta semana" value={form.max} min={0} max={30} onChange={(n) => setForm((f) => ({ ...f, max: n }))} />
              </Field>
            )}
          </>
        )}
        <PrimaryButton type="button" disabled={!form.date || pending || (!form.blocked && !form.custom && !editing)} onClick={save}>
          {editing ? "Guardar cambios" : form.blocked ? "Bloquear semana" : "Guardar semana"}
        </PrimaryButton>
        {editing && (
          <ConfirmButton
            label="Quitar la regla de esta semana"
            confirmLabel="Sí, quitar"
            disabled={pending}
            onConfirm={() => run(() => deleteVacationWeek({ date: form.date }), { msg: "Semana normal otra vez", onDone: () => setForm(empty) })}
          />
        )}
      </div>
    </Card>
  );
}

/** Lunes de la semana de una fecha del <input type="date"> (solo para mostrar). */
function mondayOfInput(date: string): DateStr {
  const d = new Date(`${date}T12:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10) as DateStr;
}

function PinsCard({ pins, pageReady }: { pins: PinRow[]; pageReady: boolean }) {
  return (
    <Card title="PIN de cada empleado">
      <p className="mb-3 text-[14px] text-muted">
        Fijo y distinto para cada uno: con él entran a elegir sus vacaciones. También lo ves en su ficha.
        {!pageReady && " La página para los empleados llega en la siguiente fase; de momento no hace falta mandarlo."}
      </p>
      <ul className="flex flex-col divide-y divide-line" aria-label="PIN de vacaciones">
        {pins.map((p) => (
          <li key={p.id} className="flex min-h-11 items-center justify-between gap-3 py-1.5">
            <span className="min-w-0 truncate text-[16px]">{p.name}</span>
            <span className="font-mono text-[18px] font-semibold tracking-[0.2em] tabular-nums">{p.pin}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
