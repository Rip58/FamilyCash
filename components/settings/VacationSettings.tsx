"use client";

import { useState } from "react";
import { deleteVacationWeek, saveVacationCampaign, saveVacationWeek } from "@/app/actions/vacations";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icons";
import { notify } from "@/components/ui/toast";
import { addDays, isoWeekNumber } from "@/lib/dates";
import { type VacationCampaignView, type VacationWeekView, type WeekRuleRange, groupWeekRules, mondaysBetween, ruleRangeLabel } from "@/lib/vacations";
import { BackHeader, ConfirmButton, Field, PrimaryButton, Stepper, Toggle, inputClass, useRun } from "./kit";

type Dept = { id: string; name: string; color: string | null; secondary: boolean };
type PinRow = { id: string; name: string; pin: string; invite: string | null };

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
  const ranges = groupWeekRules(weeks);
  const empty = { from: "", to: "", blocked: true, reason: "", custom: false, max: 1, editing: null as WeekRuleRange | null };
  const [form, setForm] = useState(empty);
  const to = form.to || form.from;
  const span = form.from ? mondaysBetween(form.from, to) : [];
  const valid = !!form.from && (form.blocked || form.custom || !!form.editing);

  const edit = (r: WeekRuleRange) =>
    setForm({ from: r.from, to: r.to, blocked: r.blocked, reason: r.reason ?? "", custom: r.maxOverride != null, max: r.maxOverride ?? 1, editing: r });

  const save = () =>
    run(
      async () => {
        // Al cambiar las fechas de una regla, lo que queda fuera vuelve a ser normal.
        if (form.editing) {
          const r = await deleteVacationWeek({ date: form.editing.from, to: form.editing.to });
          if (!r.ok) return r;
        }
        return saveVacationWeek({
          date: form.from,
          to,
          blocked: form.blocked,
          reason: form.blocked ? form.reason : null,
          maxOverride: !form.blocked && form.custom ? form.max : null,
        });
      },
      { msg: form.blocked ? "Semanas bloqueadas" : "Guardado", onDone: () => setForm(empty) },
    );

  const dateInput = (id: string, label: string, value: string, onChange: (v: string) => void) => (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[13px] text-muted">{label}</span>
      <input
        id={id}
        aria-label={label}
        type="date"
        min={`${year - 1}-12-28`}
        max={`${year}-12-31`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputClass, "px-2 text-[16px]")}
      />
    </label>
  );

  return (
    <Card title="Semanas con regla propia">
      <p className="mb-3 text-[14px] text-muted">
        Bloquea las semanas de mucho trabajo (los empleados las ven rayadas y no las pueden elegir) o cambia el máximo
        solo esas semanas. Pon la fecha de inicio y la final: se aplica a todas las semanas que tocan.
      </p>
      {ranges.length > 0 && (
        <ul className="mb-4 flex flex-col gap-1.5" aria-label="Semanas guardadas">
          {ranges.map((r) => (
            <li key={r.from}>
              <button
                type="button"
                onClick={() => edit(r)}
                className={cn(
                  "flex min-h-12 w-full items-center justify-between gap-3 rounded-control bg-surface-2 px-3 py-2 text-left",
                  form.editing?.from === r.from && "ring-2 ring-accent",
                )}
              >
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium tabular-nums">{ruleRangeLabel(r)}</span>
                  <span className="block truncate text-[13px] text-muted">
                    {r.weeks === 1 ? `S${isoWeekNumber(r.from)}` : `${r.weeks} semanas`}
                    {r.reason ? ` · ${r.reason}` : ""}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold",
                    r.blocked ? "bg-danger/12 text-danger" : "bg-accent/12 text-accent",
                  )}
                >
                  {r.blocked ? "Bloqueada" : `Máx. ${r.maxOverride}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3 rounded-control border border-line p-3">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">{form.editing ? "Cambiar" : "Añadir"}</p>
        <div className="flex gap-2">
          {dateInput("vacation-rule-from", "Fecha de inicio", form.from, (v) => setForm((f) => ({ ...f, from: v, to: f.to && f.to < v ? v : f.to })))}
          {dateInput("vacation-rule-to", "Fecha final", form.to, (v) => setForm((f) => ({ ...f, to: v })))}
        </div>
        {span.length > 0 && (
          <p className="-mt-1 text-[14px] font-medium tabular-nums">
            {ruleRangeLabel({ from: span[0]!, to: addDays(span.at(-1)!, 6) })} ·{" "}
            {span.length === 1 ? "1 semana" : `${span.length} semanas`}
          </p>
        )}
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
            <Toggle label="Otro máximo esas semanas" checked={form.custom} onChange={(v) => setForm((f) => ({ ...f, custom: v }))} />
            {form.custom && (
              <Field label="Máximo a la vez (todos los departamentos)">
                <Stepper label="Máximo esas semanas" value={form.max} min={0} max={30} onChange={(n) => setForm((f) => ({ ...f, max: n }))} />
              </Field>
            )}
          </>
        )}
        <PrimaryButton type="button" disabled={!valid || pending} onClick={save}>
          {form.editing ? "Guardar cambios" : form.blocked ? "Bloquear" : "Guardar"}
        </PrimaryButton>
        {form.editing && (
          <ConfirmButton
            label="Quitar la regla"
            confirmLabel="Sí, quitar"
            disabled={pending}
            onConfirm={() =>
              run(() => deleteVacationWeek({ date: form.editing!.from, to: form.editing!.to }), {
                msg: "Semanas normales otra vez",
                onDone: () => setForm(empty),
              })
            }
          />
        )}
        {form.editing && (
          <button type="button" onClick={() => setForm(empty)} className="min-h-11 text-[15px] font-medium text-accent">
            Añadir otra en vez de cambiar esta
          </button>
        )}
      </div>
    </Card>
  );
}

function PinsCard({ pins, pageReady }: { pins: PinRow[]; pageReady: boolean }) {
  return (
    <Card title="PIN de cada empleado">
      <p className="mb-3 text-[14px] text-muted">
        Fijo y distinto para cada uno: con él entran a elegir sus vacaciones. También lo ves en su ficha.
        {pageReady && " Toca el botón para mandarle el enlace y su PIN por WhatsApp."}
        {!pageReady && " La página para los empleados llega en la siguiente fase; de momento no hace falta mandarlo."}
      </p>
      <ul className="flex flex-col divide-y divide-line" aria-label="PIN de vacaciones">
        {pins.map((p) => (
          <li key={p.id} className="flex min-h-11 items-center justify-between gap-3 py-1.5">
            <span className="min-w-0 truncate text-[16px]">{p.name}</span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-[18px] font-semibold tracking-[0.2em] tabular-nums">{p.pin}</span>
              {p.invite && (
                <button
                  type="button"
                  aria-label={`Mandar enlace y PIN a ${p.name}`}
                  onClick={() => shareInvite(p.invite!)}
                  className="press flex h-11 w-11 items-center justify-center rounded-full bg-accent/12 text-accent"
                >
                  <Icon name="share" className="h-5 w-5" strokeWidth={2.2} />
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

async function shareInvite(text: string) {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    notify("Mensaje copiado");
  } catch {
    notify("No se pudo copiar", "error");
  }
}
