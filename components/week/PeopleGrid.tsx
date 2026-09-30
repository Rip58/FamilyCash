"use client";

import { useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { setCellStatus } from "@/app/actions/week";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/components/ui/cn";
import { type DateStr, WEEKDAY_LETTERS, formatDayLong } from "@/lib/dates";
import { isDayOffStatus } from "@/lib/schedule";
import { nextCycleCode, shortNames, statusAbbr } from "@/lib/week";
import type { GridStatus, PeopleGridData } from "./types";

const LONG_PRESS_MS = 450;
const GRID_COLS = "grid-cols-[minmax(0,1fr)_repeat(7,36px)_34px]";

interface CellValue {
  statusId: string;
  reason: string | null;
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
  onTap,
  onLong,
}: {
  status: GridStatus;
  label: string;
  hasReason: boolean;
  onTap: () => void;
  onLong: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        fired.current = false;
        origin.current = { x: e.clientX, y: e.clientY };
        clear();
        timer.current = setTimeout(() => {
          fired.current = true;
          timer.current = null;
          onLong();
        }, LONG_PRESS_MS);
      }}
      onPointerMove={(e) => {
        const o = origin.current;
        if (o && (Math.abs(e.clientX - o.x) > 10 || Math.abs(e.clientY - o.y) > 10)) clear();
      }}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (fired.current) {
          fired.current = false;
          return;
        }
        onTap();
      }}
      className="relative flex h-11 w-9 select-none items-center justify-center [-webkit-touch-callout:none] [touch-action:manipulation]"
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
    </button>
  );
}

function CellSheetBody({
  statuses,
  initial,
  onSave,
}: {
  statuses: GridStatus[];
  initial: CellValue;
  onSave: (v: CellValue) => void;
}) {
  const [statusId, setStatusId] = useState(initial.statusId);
  const [reason, setReason] = useState(initial.reason ?? "");
  return (
    <div className="flex flex-col gap-4 pt-1">
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
      <button
        type="button"
        onClick={() => onSave({ statusId, reason: reason.trim() || null })}
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
  const byCode = useMemo(() => new Map(statuses.map((s) => [s.code, s])), [statuses]);

  const shortById = useMemo(() => {
    const rows = groups.flatMap((g) => g.rows);
    const short = shortNames(rows.map((r) => r.name));
    return new Map(rows.map((r, i) => [r.employeeId, short[i]!]));
  }, [groups]);

  const base = useMemo(() => {
    const m: Record<string, CellValue> = {};
    for (const g of groups)
      for (const r of g.rows)
        r.cells.forEach((c, i) => {
          m[keyOf(r.employeeId, days[i]!)] = { statusId: c.statusId, reason: c.reason };
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

  const change = (target: Target, value: CellValue) => {
    setError(null);
    startTransition(async () => {
      applyOptimistic({ key: keyOf(target.employeeId, target.date), value });
      const res = await setCellStatus(target.employeeId, target.date, value.statusId, value.reason);
      if (!res.ok) setError(res.error);
    });
  };

  const onTap = (target: Target) => {
    const cur = cells[keyOf(target.employeeId, target.date)]!;
    const curStatus = statusById.get(cur.statusId)!;
    const nextCode = nextCycleCode(curStatus.code);
    const next = nextCode ? byCode.get(nextCode) : undefined;
    if (!next) {
      setSheet({ target, open: true });
      return;
    }
    change(target, { statusId: next.id, reason: null });
  };

  const sheetKey = sheet ? keyOf(sheet.target.employeeId, sheet.target.date) : "";
  const sheetValue = sheet ? cells[sheetKey] : undefined;
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
        <span className="pb-1 text-center text-[11px] font-medium text-muted" title="Días libres">
          Lib.
        </span>
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
              return (
                <div key={r.employeeId} className={cn("grid items-center border-b border-line last:border-b-0", GRID_COLS)}>
                  <span className="truncate px-4 text-[15px]" title={r.name}>
                    {shortById.get(r.employeeId)}
                  </span>
                  {days.map((d, i) => {
                    const v = values[i]!;
                    const status = statusById.get(v.statusId)!;
                    const target = { employeeId: r.employeeId, name: r.name, date: d };
                    return (
                      <CellButton
                        key={d}
                        status={status}
                        hasReason={!!v.reason}
                        label={`${r.name}, ${formatDayLong(d)}: ${status.label}${v.reason ? ` (${v.reason})` : ""}`}
                        onTap={() => onTap(target)}
                        onLong={() => setSheet({ target, open: true })}
                      />
                    );
                  })}
                  <span
                    className={cn(
                      "mx-auto flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-[13px] font-semibold",
                      warn ? "bg-warning/25 text-warning" : "text-muted",
                    )}
                    title={warn ? `Días libres: ${daysOff} (esperados ${daysOffPerWeek})` : "Días libres"}
                    aria-label={`${daysOff} días libres${warn ? `, se esperaban ${daysOffPerWeek}` : ""}`}
                    data-warning={warn ? "true" : undefined}
                  >
                    {daysOff}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <p className="px-4 pt-3 text-[12px] text-muted">
        Toca una celda para cambiar Trabaja / Fiesta / Fiesta retribuida. Mantén pulsado para elegir otro estado o
        motivo.
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
            onSave={(v) => {
              change(sheet.target, v);
              setSheet({ ...sheet, open: false });
            }}
          />
        )}
      </BottomSheet>
    </div>
  );
}
