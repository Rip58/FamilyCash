"use client";

import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { setOvertime } from "@/app/actions/day";
import { setCellStatus } from "@/app/actions/week";
import { OvertimeStepper } from "@/components/day/OvertimeStepper";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/components/ui/cn";
import { type DateStr, WEEKDAY_LETTERS, formatDayLong } from "@/lib/dates";
import { OVERTIME_MAX, clampOvertime, formatOvertime } from "@/lib/overtime";
import { isDayOffStatus } from "@/lib/schedule";
import { compactNames, statusAbbr, weekSummary } from "@/lib/week";
import type { GridStatus, PeopleGridData } from "./types";

const GRID_COLS = "grid-cols-[minmax(0,1fr)_repeat(7,34px)_60px]";
const PEEK_MS = 2500;

interface CellValue {
  statusId: string;
  reason: string | null;
  extraMinutes: number | null;
  extraNote: string | null;
}
interface Target {
  employeeId: string;
  name: string;
  date: DateStr;
}

const keyOf = (employeeId: string, date: DateStr) => `${employeeId}|${date}`;

function CellButton({
  status,
  label,
  hasReason,
  hasExtra,
  pending,
  onTap,
}: {
  status: GridStatus;
  label: string;
  hasReason: boolean;
  hasExtra: boolean;
  /** Hay una petición pendiente que cubre esta celda. */
  pending: boolean;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onTap}
      className="relative flex h-11 w-[34px] select-none items-center justify-center [touch-action:manipulation]"
    >
      <span
        className={cn(
          "flex h-8 w-[30px] items-center justify-center rounded-[8px] border text-[13px] font-semibold",
          status.isWorking ? "text-muted" : "text-fg",
        )}
        style={{
          borderColor: `${status.color}${status.isWorking ? "55" : "cc"}`,
          backgroundColor: `${status.color}${status.isWorking ? "1a" : "44"}`,
        }}
      >
        {statusAbbr(status)}
      </span>
      {hasReason && (
        <span aria-hidden="true" className="absolute right-0.5 top-1.5 h-1.5 w-1.5 rounded-full bg-fg/60" />
      )}
      {hasExtra && (
        <span
          aria-hidden="true"
          data-extra-dot
          className="absolute left-0 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-0.5 text-[9px] font-bold leading-none text-accent-fg"
        >
          X
        </span>
      )}
      {pending && (
        <span
          aria-hidden="true"
          data-pending-dot
          className="absolute bottom-1 right-0.5 h-2 w-2 rounded-full bg-warning ring-1 ring-surface"
        />
      )}
    </button>
  );
}

/**
 * Nombre compacto (alias). Al tocarlo se despliega encima de la fila una etiqueta con el
 * nombre completo y el departamento; se oculta sola o al tocar en cualquier otro sitio.
 */
function NameCell({
  compact,
  name,
  departmentName,
  open,
  onToggle,
}: {
  compact: string;
  name: string;
  departmentName: string | null;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={`${name}. Toca para ver el nombre completo`}
        data-peek-name
        className="flex h-11 w-full min-w-0 items-center pl-4 pr-1 text-left text-[15px] [touch-action:manipulation]"
      >
        <span className="truncate">{compact}</span>
      </button>
      {open && (
        <span
          role="status"
          className="animate-peek pointer-events-none absolute left-2 top-1/2 z-20 flex max-w-[calc(100vw-24px)] -translate-y-1/2 flex-col rounded-[12px] bg-fg px-3 py-1.5 text-bg shadow-lg"
        >
          <span className="whitespace-nowrap text-[15px] font-semibold leading-tight">{name}</span>
          {departmentName && <span className="whitespace-nowrap text-[12px] leading-tight opacity-70">{departmentName}</span>}
        </span>
      )}
    </div>
  );
}

const QUICK_EXTRA = [
  { label: "+30 min", minutes: 30 },
  { label: "+1 h", minutes: 60 },
  { label: "+2 h", minutes: 120 },
];

function CellSheetBody({
  statuses,
  initial,
  pending,
  onSave,
}: {
  statuses: GridStatus[];
  initial: CellValue;
  pending: string | null;
  onSave: (v: CellValue) => void;
}) {
  const [statusId, setStatusId] = useState(initial.statusId);
  const [reason, setReason] = useState(initial.reason ?? "");
  const [extra, setExtra] = useState(initial.extraMinutes ?? 0);
  const [extraNote, setExtraNote] = useState(initial.extraNote ?? "");
  const working = statuses.find((s) => s.id === statusId)?.isWorking ?? false;
  return (
    <div className="flex flex-col gap-4 pt-1">
      {pending && (
        <p
          data-testid="pending-request"
          className="rounded-control bg-warning/20 px-3 py-2 text-[14px] font-medium text-[#92600a] dark:text-warning"
        >
          Petición pendiente: {pending}
        </p>
      )}
      <Segmented
        wrap
        aria-label="Estado"
        value={statusId}
        onChange={setStatusId}
        options={statuses.map((s) => ({ value: s.id, label: s.label, color: s.color }))}
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-muted">Motivo (opcional)</span>
        <input
          type="text"
          value={reason}
          maxLength={200}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej.: médico, cambio de turno…"
          className="min-h-11 rounded-control bg-surface-2 px-3 text-[16px] outline-none focus:ring-2 focus:ring-accent"
        />
      </label>
      {working ? (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-muted">Horas extra</span>
          <div className="flex flex-wrap items-center gap-2">
            <OvertimeStepper label="Horas extra" minutes={extra} onChange={setExtra} />
            {QUICK_EXTRA.map((q) => (
              <button
                key={q.minutes}
                type="button"
                disabled={extra >= OVERTIME_MAX}
                onClick={() => setExtra(clampOvertime(extra + q.minutes))}
                className="min-h-11 rounded-full bg-surface-2 px-3 text-[14px] font-semibold text-accent disabled:opacity-30"
              >
                {q.label}
              </button>
            ))}
          </div>
          {extra > 0 && (
            <input
              type="text"
              aria-label="Motivo de las horas extra"
              value={extraNote}
              maxLength={200}
              onChange={(e) => setExtraNote(e.target.value)}
              placeholder="Motivo de las horas extra (opcional)"
              className="min-h-11 rounded-control bg-surface-2 px-3 text-[16px] outline-none focus:ring-2 focus:ring-accent"
            />
          )}
        </div>
      ) : (
        initial.extraMinutes ? (
          <p className="text-[13px] text-muted">
            Tenía {formatOvertime(initial.extraMinutes)} extra: se quitarán al guardar porque no trabaja.
          </p>
        ) : null
      )}
      <button
        type="button"
        onClick={() =>
          onSave({
            statusId,
            reason: reason.trim() || null,
            extraMinutes: working && extra > 0 ? extra : null,
            extraNote: working && extra > 0 ? extraNote.trim() || null : null,
          })
        }
        className="min-h-11 rounded-control bg-accent text-[16px] font-semibold text-accent-fg"
      >
        Guardar
      </button>
    </div>
  );
}

export function PeopleGrid({ data }: { data: PeopleGridData }) {
  const { days, today, statuses, groups, daysOffPerWeek } = data;
  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);

  const shortById = useMemo(() => {
    const rows = groups.flatMap((g) => g.rows);
    const short = compactNames(rows);
    return new Map(rows.map((r, i) => [r.employeeId, short[i]!]));
  }, [groups]);

  // Nombre completo desplegado (uno a la vez)
  const [peekId, setPeekId] = useState<string | null>(null);
  useEffect(() => {
    if (!peekId) return;
    const t = setTimeout(() => setPeekId(null), PEEK_MS);
    const close = (e: PointerEvent) => {
      if (!(e.target instanceof Element && e.target.closest("[data-peek-name]"))) setPeekId(null);
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("scroll", () => setPeekId(null), { once: true, passive: true });
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", close);
    };
  }, [peekId]);

  const base = useMemo(() => {
    const m: Record<string, CellValue> = {};
    for (const g of groups)
      for (const r of g.rows)
        r.cells.forEach((c, i) => {
          m[keyOf(r.employeeId, days[i]!)] = {
            statusId: c.statusId,
            reason: c.reason,
            extraMinutes: c.extraMinutes,
            extraNote: c.extraNote,
          };
        });
    return m;
  }, [groups, days]);

  const [cells, applyOptimistic] = useOptimistic(
    base,
    (state, u: { key: string; value: CellValue }) => ({ ...state, [u.key]: u.value }),
  );
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ target: Target; open: boolean } | null>(null);

  const change = (target: Target, prev: CellValue, value: CellValue) => {
    setError(null);
    startTransition(async () => {
      applyOptimistic({ key: keyOf(target.employeeId, target.date), value });
      if (value.statusId !== prev.statusId || value.reason !== prev.reason) {
        const res = await setCellStatus(target.employeeId, target.date, value.statusId, value.reason);
        if (!res.ok) return setError(res.error);
      }
      if ((value.extraMinutes ?? 0) !== (prev.extraMinutes ?? 0) || value.extraNote !== prev.extraNote) {
        const res = await setOvertime({
          employeeId: target.employeeId,
          date: target.date,
          extraMinutes: value.extraMinutes ?? 0,
          extraNote: value.extraNote,
        });
        if (!res.ok) setError(res.error);
      }
    });
  };

  const sheetKey = sheet ? keyOf(sheet.target.employeeId, sheet.target.date) : "";
  const sheetValue = sheet ? cells[sheetKey] : undefined;
  const pendingByKey = useMemo(() => {
    const m: Record<string, string> = {};
    for (const g of groups)
      for (const r of g.rows)
        r.cells.forEach((c, i) => {
          if (c.pending) m[keyOf(r.employeeId, days[i]!)] = c.pending;
        });
    return m;
  }, [groups, days]);
  const sheetStatuses = sheetValue
    ? statuses.filter((s) => s.active || s.id === sheetValue.statusId)
    : [];

  return (
    <div className="-mx-4">
      {error && (
        <p role="alert" className="mx-4 mb-2 rounded-control bg-danger/15 px-3 py-2 text-[14px] text-danger">
          {error}
        </p>
      )}
      {/* Cabecera de columnas fija */}
      <div
        className={cn(
          "sticky top-[env(safe-area-inset-top)] z-10 grid items-end border-b border-line bg-bg pb-1",
          GRID_COLS,
        )}
      >
        <span className="px-4 pb-1 text-[12px] font-medium text-muted">Persona</span>
        {days.map((d, i) => (
          <span key={d} className="flex flex-col items-center leading-tight">
            <span className="text-[12px] font-semibold text-muted">{WEEKDAY_LETTERS[i]}</span>
            <span
              className={cn(
                "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[12px]",
                d === today ? "bg-accent font-semibold text-accent-fg" : "text-muted",
              )}
            >
              {Number(d.slice(8))}
            </span>
          </span>
        ))}
        <span className="pb-1 text-center text-[11px] font-medium text-muted">Total</span>
      </div>

      {groups.map((g) => (
        <section key={g.id} aria-label={g.name}>
          <h3 className="flex items-center gap-2 px-4 pb-1 pt-4 text-[13px] font-semibold uppercase tracking-wide text-muted">
            {g.color && (
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />
            )}
            {g.name}
          </h3>
          <div className="bg-surface">
            {g.rows.map((r) => {
              const values = days.map((d) => cells[keyOf(r.employeeId, d)]!);
              const daysOff = values.filter((v) => isDayOffStatus(statusById.get(v.statusId)!)).length;
              const warn = daysOff !== daysOffPerWeek;
              const summary = weekSummary(
                values.map((v) => ({ status: statusById.get(v.statusId)!, extraMinutes: v.extraMinutes })),
                statuses,
              );
              return (
                <div key={r.employeeId} className={cn("grid items-center border-b border-line last:border-b-0", GRID_COLS)}>
                  <NameCell
                    compact={shortById.get(r.employeeId)!}
                    name={r.name}
                    departmentName={r.departmentName}
                    open={peekId === r.employeeId}
                    onToggle={() => setPeekId((cur) => (cur === r.employeeId ? null : r.employeeId))}
                  />
                  {days.map((d, i) => {
                    const v = values[i]!;
                    const status = statusById.get(v.statusId)!;
                    const target = { employeeId: r.employeeId, name: r.name, date: d };
                    return (
                      <CellButton
                        key={d}
                        status={status}
                        hasReason={!!v.reason}
                        hasExtra={(v.extraMinutes ?? 0) > 0}
                        pending={!!pendingByKey[keyOf(r.employeeId, d)]}
                        label={`${r.name}, ${formatDayLong(d)}: ${status.label}${v.reason ? ` (${v.reason})` : ""}${v.extraMinutes ? `, ${formatOvertime(v.extraMinutes)} extra` : ""}${pendingByKey[keyOf(r.employeeId, d)] ? ". Petición pendiente" : ""}`}
                        onTap={() => setSheet({ target, open: true })}
                      />
                    );
                  })}
                  <span
                    className="flex flex-wrap content-center justify-center gap-x-1 px-0.5 text-[11px] font-semibold leading-[13px] tabular-nums"
                    aria-label={`Semana: ${summary.map((t) => t.text).join(" ")}${warn ? `. ${daysOff} días libres, se esperaban ${daysOffPerWeek}` : ""}`}
                    data-warning={warn ? "true" : undefined}
                  >
                    {summary.map((t) => (
                      <span
                        key={t.key}
                        className={cn(
                          t.key === "extra" ? "text-accent" : "text-muted",
                          warn && t.dayOff && "rounded bg-warning/25 px-0.5 text-warning",
                        )}
                      >
                        {t.text}
                      </span>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <p className="px-4 pt-3 text-[12px] text-muted">
        Toca un nombre para verlo completo. Toca una celda para elegir estado, motivo y horas extra. Total: T trabaja · F
        fiesta · R retribuida · B baja · V vacaciones · X horas extra.
      </p>

      <BottomSheet
        open={!!sheet?.open}
        onClose={() => setSheet((s) => (s ? { ...s, open: false } : s))}
        title={sheet ? `${sheet.target.name} · ${formatDayLong(sheet.target.date)}` : "Estado"}
      >
        {sheet && sheetValue && (
          <CellSheetBody
            key={sheetKey}
            statuses={sheetStatuses}
            initial={sheetValue}
            pending={pendingByKey[sheetKey] ?? null}
            onSave={(v) => {
              change(sheet.target, sheetValue, v);
              setSheet({ ...sheet, open: false });
            }}
          />
        )}
      </BottomSheet>
    </div>
  );
}
