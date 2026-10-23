"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  type VacationPersonDetail,
  applyVacationsToPlanning,
  deleteVacationWeek,
  getVacationPerson,
  saveVacationWeek,
  sendVacationMessage,
  setVacationStatus,
} from "@/app/actions/vacations";
import { Segmented } from "@/components/ui/Segmented";
import { Stepper } from "@/components/settings/kit";
import { Toggle } from "@/components/ui/Toggle";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { cn } from "@/components/ui/cn";
import { notify } from "@/components/ui/toast";
import { type DateStr, MONTH_SHORT, WEEKDAY_LETTERS, addDays, formatDayMonth, formatWeekRange, isoWeekNumber, weekStart } from "@/lib/dates";
import {
  VACATION_STATUS_LABEL,
  type VacGridGroup,
  type VacationConflict,
  type VacationWeekView,
  type WeekRuleRange,
  countedDays,
  mondaysBetween,
  ruleRangeLabel,
  rangeLabel,
  vacationSpan,
} from "@/lib/vacations";

const GRID_COLS = "grid-cols-[minmax(0,1fr)_repeat(7,34px)_52px]";
const href = (monday: DateStr) => `/semana/vacaciones?semana=${monday}`;

/**
 * Vacaciones de toda la plantilla, con el mismo aspecto que Semana → Personas: una semana cada vez, por
 * departamentos, cuántos hay de vacaciones cada día (rojo = pasa del máximo), ⋯ para bloquear la semana o cambiar
 * el máximo y, al tocar a alguien, sus periodos y su última firma.
 */
export function VacationOverview({
  year,
  monday,
  prev,
  next,
  grid,
  rule,
  ruleRange,
  sent,
  total,
  workDays,
  conflicts,
  conflictPeriodIds,
  unread,
  cleanSentIds,
  okCount,
}: {
  year: number;
  monday: DateStr;
  prev: DateStr | null;
  next: DateStr | null;
  grid: { days: DateStr[]; groups: VacGridGroup[]; overDays: number };
  rule: VacationWeekView | null;
  ruleRange: WeekRuleRange | null;
  sent: number;
  total: number;
  workDays: number;
  conflicts: (VacationConflict & { names: string[] })[];
  conflictPeriodIds: string[];
  unread: Record<string, number>;
  cleanSentIds: string[];
  okCount: number;
}) {
  const [menu, setMenu] = useState(false);
  const [tab, setTab] = useState<"personas" | "solapes">("personas");
  const unreadTotal = Object.values(unread).reduce((a, b) => a + b, 0);
  const [person, setPerson] = useState<{ id: string; name: string; open: boolean } | null>(null);
  const navBtn = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[26px] leading-none text-accent active:bg-surface-2";
  const month = monday < `${year}-01-01` ? 0 : Number(monday.slice(5, 7)) - 1;

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between">
        <Link href="/semana" className="flex min-h-11 items-center gap-1 pr-2 text-[16px] text-accent">
          <span className="text-[24px] leading-none">‹</span> Semana
        </Link>
        <h1 className="text-[17px] font-semibold">Vacaciones {year}</h1>
        <button
          type="button"
          aria-label="Reglas de esta semana"
          onClick={() => setMenu(true)}
          className="press flex h-11 w-11 items-center justify-center rounded-full text-[20px] leading-none active:bg-surface-2"
        >
          ⋯
        </button>
      </div>

      <header className="flex items-center justify-between gap-1">
        {prev ? (
          <Link href={href(prev)} aria-label="Semana anterior" className={navBtn}>
            ‹
          </Link>
        ) : (
          <span className="w-11" />
        )}
        <h2 className="truncate text-center text-[17px] font-semibold tracking-tight" aria-live="polite">
          Semana {isoWeekNumber(monday)} <span className="text-muted">·</span> {formatWeekRange(monday)}
        </h2>
        {next ? (
          <Link href={href(next)} aria-label="Semana siguiente" className={navBtn}>
            ›
          </Link>
        ) : (
          <span className="w-11" />
        )}
      </header>

      <nav aria-label="Ir al mes" className="no-scrollbar -mx-4 mb-2 flex gap-1.5 overflow-x-auto px-4 py-1">
        {MONTH_SHORT.map((m, i) => {
          const first = weekStart(`${year}-${String(i + 1).padStart(2, "0")}-01` as DateStr);
          return (
            <Link
              key={m}
              href={href(first)}
              ref={i === month ? (el) => el?.scrollIntoView({ block: "nearest", inline: "center" }) : undefined}
              className={cn(
                "flex min-h-9 shrink-0 items-center rounded-full px-3 text-[14px] font-medium capitalize",
                i === month ? "bg-accent text-accent-fg" : "bg-surface text-fg",
              )}
            >
              {m}
            </Link>
          );
        })}
      </nav>

      <p className="mb-2 flex flex-wrap gap-x-3 px-1 text-[13px] text-muted">
        <span>
          <b className="text-fg">{sent}</b>/{total} han enviado
        </span>
        {grid.overDays > 0 && (
          <span className="font-semibold text-danger">
            {grid.overDays} {grid.overDays === 1 ? "día pasa" : "días pasan"} del máximo
          </span>
        )}
      </p>

      {rule?.blocked && (
        <p className="vac-blocked mb-2 rounded-card px-4 py-2.5 text-[14px] font-semibold text-danger">
          Semana bloqueada{rule.reason ? ` · ${rule.reason}` : ""}
          {ruleRange && ruleRange.weeks > 1 && <span className="font-normal"> ({ruleRangeLabel(ruleRange)})</span>}
        </p>
      )}
      {rule && !rule.blocked && rule.maxOverride != null && (
        <p className="mb-2 rounded-card bg-accent/10 px-4 py-2.5 text-[14px] font-medium text-accent">
          Esta semana: máximo {rule.maxOverride} a la vez
        </p>
      )}

      <Segmented
        aria-label="Vista"
        compact
        className="mb-2"
        value={tab}
        onChange={setTab}
        options={[
          { value: "personas", label: unreadTotal ? `Personas · 💬 ${unreadTotal}` : "Personas" },
          { value: "solapes", label: conflicts.length ? `Solapes · ${conflicts.length}` : "Solapes y cierre" },
        ]}
      />

      {tab === "personas" ? (
        <>
          <Grid grid={grid} unread={unread} onPerson={(id, name) => setPerson({ id, name, open: true })} />
          <p className="px-1 pt-3 text-[12px] text-muted">
            V = descuenta · F = su fiesta (no cuenta) · en rojo, los días que pasan del máximo. Toca un nombre para ver sus
            periodos, su firma y el chat. Punto azul = te ha escrito.
          </p>
        </>
      ) : (
        <Conflicts
          year={year}
          conflicts={conflicts}
          cleanSentIds={cleanSentIds}
          okCount={okCount}
          onPerson={(id, name) => setPerson({ id, name, open: true })}
        />
      )}

      <WeekRuleSheet key={monday} open={menu} onClose={() => setMenu(false)} monday={monday} rule={rule} range={ruleRange} />
      <PersonSheet
        person={person}
        year={year}
        workDays={workDays}
        conflictPeriodIds={conflictPeriodIds}
        onClose={() => setPerson((p) => (p ? { ...p, open: false } : p))}
      />
    </div>
  );
}

function Grid({
  grid,
  unread,
  onPerson,
}: {
  grid: { days: DateStr[]; groups: VacGridGroup[] };
  unread: Record<string, number>;
  onPerson: (id: string, name: string) => void;
}) {
  return (
    <div className="-mx-4">
      <div className={cn("sticky top-[env(safe-area-inset-top)] z-10 grid items-end border-b border-line bg-bg pb-1", GRID_COLS)}>
        <span className="px-4 pb-1 text-[12px] font-medium text-muted">Persona</span>
        {grid.days.map((d, i) => (
          <span key={d} className="flex flex-col items-center leading-tight">
            <span className="text-[12px] font-semibold text-muted">{WEEKDAY_LETTERS[i]}</span>
            <span className="text-[12px] text-muted">{Number(d.slice(8))}</span>
          </span>
        ))}
        <span className="pb-1 text-center text-[11px] font-medium text-muted">Total</span>
      </div>
      <div className="mt-2 flex flex-col gap-3">
        {grid.groups.map((g) => (
          <section key={g.id} aria-label={g.name} className="mx-1.5 overflow-hidden rounded-card bg-surface">
            <h3 className="flex min-h-11 items-center justify-between gap-2 px-3 text-[16px] font-bold text-white" style={{ backgroundColor: g.color ?? "#64748b" }}>
              <span className="min-w-0 truncate [text-shadow:0_1px_1px_rgb(0_0_0/0.15)]">{g.name}</span>
              <span className="shrink-0 rounded-full bg-white/25 px-2 py-0.5 text-[12px] font-semibold">
                {g.max === null ? "no cuenta" : `máx. ${g.max}`}
              </span>
            </h3>
            <div className={cn("grid items-center border-b border-line py-1", GRID_COLS)}>
              <span className="pl-2.5 text-[11px] font-medium text-muted">De vacaciones</span>
              {g.counts.map((c, i) => (
                <span
                  key={i}
                  className={cn("text-center text-[12px] font-semibold tabular-nums", g.over[i] ? "text-danger" : "text-muted")}
                  aria-label={`${c} de vacaciones${g.over[i] ? ", pasa del máximo" : ""}`}
                >
                  {c}
                </span>
              ))}
              <span />
            </div>
            {g.rows.map((r) => (
              <div key={r.employeeId} className={cn("grid items-center border-b border-line last:border-b-0", GRID_COLS)}>
                <button
                  type="button"
                  onClick={() => onPerson(r.employeeId, r.name)}
                  className="flex min-h-11 min-w-0 items-center gap-1.5 pl-2.5 pr-1 text-left text-[15px]"
                  aria-label={`${r.name}: ver sus vacaciones${unread[r.employeeId] ? ", te ha escrito" : ""}`}
                >
                  <span className="truncate">{r.alias ?? r.name}</span>
                  {!!unread[r.employeeId] && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-accent" />}
                </button>
                {r.cells.map((c, i) => {
                  const bad = c === "work" && g.over[i];
                  return (
                    <span key={i} className="flex justify-center py-1">
                      <span
                        className={cn(
                          "flex h-8 w-[30px] items-center justify-center rounded-[8px] text-[13px] font-bold",
                          c === "work" && "border border-[#3b82f6] bg-[#dbeafe] text-[#1d4ed8]",
                          c === "fiesta" && "border border-[#93c5fd] bg-[#eff6ff] text-[#3b82f6]",
                          !c && "border border-dashed border-line",
                          bad && "border-2 border-danger",
                        )}
                      >
                        {c === "work" ? "V" : c === "fiesta" ? "F" : ""}
                      </span>
                    </span>
                  );
                })}
                <span className="text-center text-[11px] font-semibold leading-[13px] text-muted tabular-nums">
                  {r.work || r.fiesta ? `${r.work ? `${r.work}V` : ""} ${r.fiesta ? `${r.fiesta}F` : ""}`.trim() : "—"}
                </span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

function WeekRuleSheet({
  open,
  onClose,
  monday,
  rule,
  range,
}: {
  open: boolean;
  onClose: () => void;
  monday: DateStr;
  rule: VacationWeekView | null;
  range: WeekRuleRange | null;
}) {
  const router = useRouter();
  const [blocked, setBlocked] = useState(rule?.blocked ?? false);
  const [reason, setReason] = useState(rule?.reason ?? "");
  const [custom, setCustom] = useState(rule?.maxOverride != null);
  const [max, setMax] = useState(rule?.maxOverride ?? 1);
  // De la fecha de inicio a la final: si la semana ya es parte de varias seguidas, se cambian todas juntas.
  const [from, setFrom] = useState<string>(range?.from ?? monday);
  const [to, setTo] = useState<string>(range?.to ?? addDays(monday, 6));
  const weeksCount = from && to ? mondaysBetween(from, to).length : 0;
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      if (range) {
        const del = await deleteVacationWeek({ date: range.from, to: range.to });
        if (!del.ok) return notify(del.error, "error");
      }
      const r = await saveVacationWeek({ date: from, to, blocked, reason: blocked ? reason : null, maxOverride: !blocked && custom ? max : null });
      if (r.ok) {
        notify(blocked ? "Semana bloqueada" : custom ? "Máximo guardado" : "Semana normal");
        onClose();
        router.refresh();
      } else notify(r.error, "error");
    });

  return (
    <BottomSheet open={open} onClose={onClose} title={`Semana ${isoWeekNumber(monday)} · ${formatWeekRange(monday)}`}>
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[13px] text-muted">Fecha de inicio</span>
            <input
              type="date"
              aria-label="Fecha de inicio"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                if (to < e.target.value) setTo(e.target.value);
              }}
              className="min-h-11 w-full rounded-control bg-surface-2 px-2 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[13px] text-muted">Fecha final</span>
            <input
              type="date"
              aria-label="Fecha final"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="min-h-11 w-full rounded-control bg-surface-2 px-2 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
        </div>
        {weeksCount > 0 && (
          <p className="-mt-1 text-[14px] text-muted">
            Se aplica a {weeksCount === 1 ? "1 semana" : `${weeksCount} semanas seguidas`}.
          </p>
        )}
        <div className="rounded-card bg-surface-2 p-3">
          <Toggle label="No se pueden pedir vacaciones" checked={blocked} onChange={setBlocked} />
          {blocked && (
            <input
              aria-label="Motivo (lo ven los empleados)"
              value={reason}
              maxLength={80}
              placeholder="Motivo, p. ej. Inventario"
              onChange={(e) => setReason(e.target.value)}
              className="mt-2 min-h-11 w-full rounded-control bg-surface px-3 text-[17px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          )}
        </div>
        {!blocked && (
          <div className="rounded-card bg-surface-2 p-3">
            <Toggle label="Otro máximo esta semana (temporada)" checked={custom} onChange={setCustom} />
            {custom && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[15px]">Máximo a la vez</span>
                <Stepper label="Máximo esta semana" value={max} min={0} max={30} onChange={setMax} />
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="press min-h-12 w-full rounded-control bg-accent text-[17px] font-semibold text-accent-fg disabled:opacity-50"
        >
          Guardar
        </button>
        {rule && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await deleteVacationWeek({ date: range?.from ?? monday, to: range?.to ?? null });
                if (r.ok) {
                  notify("Semana normal otra vez");
                  onClose();
                  router.refresh();
                } else notify(r.error, "error");
              })
            }
            className="min-h-11 w-full rounded-control bg-surface-2 text-[16px] font-medium text-danger"
          >
            {range && range.weeks > 1 ? `Quitar la regla de las ${range.weeks} semanas` : "Quitar la regla de esta semana"}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}

function Conflicts({
  year,
  conflicts,
  cleanSentIds,
  okCount,
  onPerson,
}: {
  year: number;
  conflicts: (VacationConflict & { names: string[] })[];
  cleanSentIds: string[];
  okCount: number;
  onPerson: (id: string, name: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmApply, setConfirmApply] = useState(false);
  const act = (fn: () => Promise<{ ok: boolean; error?: string; changed?: number }>, msg: (n: number) => string) =>
    start(async () => {
      const r: { ok: boolean; error?: string; changed?: number } = await fn().catch(() => ({ ok: false, error: "No se pudo guardar." }));
      if (r.ok) {
        notify(msg(r.changed ?? 0));
        router.refresh();
      } else notify(r.error ?? "No se pudo guardar.", "error");
    });

  return (
    <div className="flex flex-col gap-3">
      {conflicts.length === 0 ? (
        <p className="rounded-card bg-surface px-4 py-3 text-[15px] text-muted">Nadie pasa del máximo en todo {year}. 👍</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Solapes">
          {conflicts.map((c) => (
            <li key={`${c.departmentId}${c.from}`} className="rounded-card border-l-4 border-danger bg-surface px-4 py-3">
              <p className="flex items-center gap-2 text-[14px]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color ?? "#64748b" }} />
                {c.departmentName} · <b>{c.from === c.to ? formatDayMonth(c.from) : `${formatDayMonth(c.from)} – ${formatDayMonth(c.to)}`}</b>
                <span className="text-muted">(máx. {c.max})</span>
              </p>
              <p className="mt-1 text-[16px] font-medium">{c.names.join(", ")}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {c.employeeIds.map((id, i) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onPerson(id, c.names[i] ?? "")}
                    className="press min-h-11 rounded-control bg-accent px-3 text-[14px] font-semibold text-accent-fg"
                  >
                    Escribir a {c.names[i]}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => act(() => setVacationStatus({ periodIds: c.periodIds, status: "OK" }), () => "Las dejas como correctas")}
                  className="min-h-11 rounded-control bg-surface-2 px-3 text-[14px] font-medium text-accent"
                >
                  Dejar todas como correctas
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-2 rounded-card bg-surface p-4">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Cierre</h3>
        <button
          type="button"
          disabled={pending || cleanSentIds.length === 0}
          onClick={() => act(() => setVacationStatus({ periodIds: cleanSentIds, status: "OK" }), (n) => `${n} marcadas como correctas`)}
          className="min-h-12 w-full rounded-control bg-surface-2 text-[15px] font-medium text-accent disabled:opacity-40"
        >
          Marcar correctas las que no chocan ({cleanSentIds.length})
        </button>
        {confirmApply ? (
          <div className="flex flex-col gap-2 rounded-control bg-accent/10 p-3">
            <p className="text-[14px]">
              Se escribirán en Semana como «Vacaciones» (y su fiesta como «Fiesta») las {okCount} correctas. Ya no las podrán
              cambiar desde su página.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmApply(false)} className="min-h-11 rounded-control bg-surface text-[15px] font-medium">
                Cancelar
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setConfirmApply(false);
                  act(() => applyVacationsToPlanning({ year }), (n) => `${n} ${n === 1 ? "periodo pasado" : "periodos pasados"} a Semana`);
                }}
                className="press min-h-11 rounded-control bg-accent text-[15px] font-semibold text-accent-fg"
              >
                Sí, pasar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={pending || okCount === 0}
            onClick={() => setConfirmApply(true)}
            className="press min-h-12 w-full rounded-control bg-accent text-[16px] font-semibold text-accent-fg disabled:opacity-40"
          >
            Pasar correctas a Semana ({okCount})
          </button>
        )}
      </section>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  SENT: "bg-surface text-muted",
  REVIEW: "bg-warning/15 text-[#b45309]",
  OK: "bg-success/15 text-[#15803d]",
  APPLIED: "bg-accent/12 text-accent",
};

function PersonSheet({
  person,
  year,
  workDays,
  conflictPeriodIds,
  onClose,
}: {
  person: { id: string; name: string; open: boolean } | null;
  year: number;
  workDays: number;
  conflictPeriodIds: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<{ id: string; data: VacationPersonDetail | null; error: string | null } | null>(null);
  const [reload, setReload] = useState(0);
  const [text, setText] = useState("");
  const [askChange, setAskChange] = useState(true);
  const [pending, start] = useTransition();
  const id = person?.id ?? null;
  useEffect(() => {
    if (!id) return;
    let alive = true;
    getVacationPerson({ employeeId: id, year })
      .then((r) => alive && setDetail({ id, data: r.ok ? r : null, error: r.ok ? null : r.error }))
      .catch(() => alive && setDetail({ id, data: null, error: "No se pudo cargar." }));
    return () => {
      alive = false;
    };
  }, [id, year, reload]);
  const d = detail?.id === id ? detail : null;
  const periods = d?.data?.periods ?? [];
  const clashing = periods.filter((p) => conflictPeriodIds.includes(p.id) && p.status !== "APPLIED").map((p) => p.id);
  const firstName = person?.name.split(/\s+/)[0] ?? "";

  const done = (msg: string) => {
    notify(msg);
    setReload((n) => n + 1);
    router.refresh();
  };
  const status = (periodId: string, s: "OK" | "REVIEW" | "SENT") =>
    start(async () => {
      const r = await setVacationStatus({ periodIds: [periodId], status: s });
      if (r.ok) done(s === "OK" ? "Correcta" : s === "REVIEW" ? "A revisar" : "Enviada");
      else notify(r.error, "error");
    });
  const send = () =>
    start(async () => {
      if (!id) return;
      const r = await sendVacationMessage({ employeeId: id, year, text, review: askChange ? clashing : [] });
      if (r.ok) {
        setText("");
        done("Mensaje enviado");
      } else notify(r.error, "error");
    });
  async function whatsapp() {
    const msg = `Hola ${firstName}: te he escrito sobre tus vacaciones. Míralo aquí: ${window.location.origin}/vacaciones`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: msg });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(msg);
      notify("Mensaje copiado");
    } catch {
      notify("No se pudo copiar", "error");
    }
  }

  return (
    <BottomSheet open={!!person?.open} onClose={onClose} title={person?.name ?? "Vacaciones"}>
      {!d ? (
        <p className="py-10 text-center text-[15px] text-muted">Cargando…</p>
      ) : d.error ? (
        <p className="py-10 text-center text-[15px] text-danger">{d.error}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[15px]">
            <b className="text-[22px] tabular-nums">{countedDays(periods)}</b> de {workDays} días laborables
          </p>
          {periods.length === 0 ? (
            <p className="rounded-card bg-surface-2 px-4 py-3 text-[15px] text-muted">Todavía no ha enviado nada.</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface-2">
              {periods.map((p) => {
                const s = vacationSpan(p);
                const clash = conflictPeriodIds.includes(p.id);
                return (
                  <li key={p.id} className="flex flex-col gap-2 px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span>
                        <b className="block text-[16px]">{rangeLabel(p)}</b>
                        <span className="text-[13px] text-muted">
                          {s.days.length} días · descuenta {s.counted}
                          {clash && <span className="font-semibold text-danger"> · choca</span>}
                        </span>
                      </span>
                      <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[12px] font-semibold", STATUS_STYLE[p.status])}>
                        {VACATION_STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </div>
                    {p.status !== "APPLIED" && (
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          disabled={pending || p.status === "OK"}
                          onClick={() => status(p.id, "OK")}
                          className="min-h-10 rounded-control bg-surface text-[14px] font-semibold text-[#15803d] disabled:opacity-40"
                        >
                          ✓ Correcta
                        </button>
                        <button
                          type="button"
                          disabled={pending || p.status === "REVIEW"}
                          onClick={() => status(p.id, "REVIEW")}
                          className="min-h-10 rounded-control bg-surface text-[14px] font-semibold text-[#b45309] disabled:opacity-40"
                        >
                          A revisar
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {periods.some((p) => p.status === "OK") && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await applyVacationsToPlanning({ year, employeeId: id });
                  if (r.ok) done("Pasadas a Semana");
                  else notify(r.error, "error");
                })
              }
              className="press min-h-12 w-full rounded-control bg-accent text-[16px] font-semibold text-accent-fg"
            >
              Pasar sus correctas a Semana
            </button>
          )}

          <section aria-label="Chat" className="flex flex-col gap-2 rounded-card bg-surface-2 p-3">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Chat con {firstName}</h3>
            {(d.data?.messages ?? []).length === 0 && <p className="text-[14px] text-muted">Todavía no os habéis escrito.</p>}
            {(d.data?.messages ?? []).map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-[15px]",
                  m.fromOwner ? "self-end rounded-br-md bg-accent text-accent-fg" : "self-start rounded-bl-md bg-surface",
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                <p className={cn("mt-0.5 text-right text-[11px]", m.fromOwner ? "opacity-80" : "text-muted")}>{m.at}</p>
              </div>
            ))}
            <textarea
              aria-label="Mensaje"
              value={text}
              maxLength={1000}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ej.: Del 9 al 15 ya hay alguien de Droguería. ¿Puedes coger otra semana?"
              className="min-h-[80px] w-full rounded-control bg-surface px-3 py-2 text-[16px] outline-none focus:ring-2 focus:ring-accent"
            />
            {clashing.length > 0 && (
              <Toggle label="Marcar lo que choca como «A revisar»" checked={askChange} onChange={setAskChange} />
            )}
            <div className="grid grid-cols-[1fr_1.4fr] gap-2">
              <button type="button" onClick={whatsapp} className="min-h-11 rounded-control bg-surface text-[14px] font-medium text-accent">
                Avisar por WhatsApp
              </button>
              <button
                type="button"
                disabled={pending || !text.trim()}
                onClick={send}
                className="press min-h-11 rounded-control bg-accent text-[15px] font-semibold text-accent-fg disabled:opacity-40"
              >
                Enviar
              </button>
            </div>
          </section>

          {d.data?.signature && (
            <section className="rounded-card bg-surface-2 p-3">
              <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">Última firma</h3>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.data.signature} alt={`Firma de ${person?.name}`} className="h-28 w-full rounded-control bg-white object-contain" />
              <p className="mt-1.5 text-[13px] text-muted">
                {d.data.signedAt} · {d.data.submissions} {d.data.submissions === 1 ? "envío firmado" : "envíos firmados"}
              </p>
            </section>
          )}
          {person && (
            <Link href={`/ajustes/empleados/${person.id}`} className="min-h-11 content-center text-center text-[16px] font-medium text-accent">
              Ver ficha
            </Link>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
