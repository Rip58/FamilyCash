"use client";

import { useMemo, useState } from "react";
import type { ActionResult } from "@/app/actions/day";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { cn } from "@/components/ui/cn";
import { formatDayMonth } from "@/lib/dates";
import { type PendingDelay, formatOvertime, proposeOvertime, totalOvertime } from "@/lib/overtime";
import type { RosterMember } from "@/lib/schedule";
import type { ShiftTimes } from "@/lib/segments";
import { OvertimeStepper } from "./OvertimeStepper";

export interface OvertimeGroup {
  id: string;
  name: string;
  color: string | null;
  members: RosterMember[];
}

interface OvertimeSheetProps {
  open: boolean;
  onClose: () => void;
  groups: OvertimeGroup[];
  shift: ShiftTimes;
  /** Retrasos de noches anteriores que aún deben recuperar, por empleado. */
  pendingDelays?: Record<string, PendingDelay[]>;
  onSave: (
    items: { employeeId: string; extraMinutes: number; extraNote: string | null; extraRecovers: boolean }[],
  ) => Promise<ActionResult>;
}

interface Row {
  minutes: number;
  note: string;
  suggested: boolean;
  noteOpen: boolean;
  /** Las horas (positivas) recuperan su retraso pendiente en vez de ser horas extra. */
  recovers: boolean;
}

/** «Debe 30 min (13 oct)» o, si las horas de esta noche lo recuperan, lo que queda / «recuperado». */
function owedLine(p: PendingDelay[], recovering: number): { text: string; done: boolean } {
  const owed = p.reduce((n, d) => n + d.minutes, 0);
  const days = p.map((d) => formatDayMonth(d.date)).join(", ");
  const left = owed - recovering;
  if (recovering > 0 && left <= 0) return { text: `Recupera el retraso del ${days}`, done: true };
  return { text: `Debe ${formatOvertime(left)} (retraso del ${days})`, done: false };
}

/**
 * Cierre de turno: horas extra (o retraso, en negativo) de todos los que trabajan esa noche. Quien debe un retraso de
 * otra noche lo ve bajo su nombre, y sus horas positivas pueden marcarse «Recupera retraso» (no son horas extra).
 */
export function OvertimeSheet({ open, onClose, groups, shift, pendingDelays = {}, onSave }: OvertimeSheetProps) {
  const initial = useMemo(() => {
    const m = new Map<string, Row>();
    for (const g of groups) {
      for (const { employee, day } of g.members) {
        const stored = day.extraMinutes ?? 0;
        const proposal = stored === 0 ? proposeOvertime(day.leftAt, shift) : null;
        m.set(employee.id, {
          minutes: stored || proposal || 0,
          note: day.extraNote ?? "",
          suggested: !!proposal,
          noteOpen: !!day.extraNote,
          recovers: stored > 0 ? day.extraRecovers : !!pendingDelays[employee.id],
        });
      }
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [rows, setRows] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (id: string, p: Partial<Row>) =>
    setRows((cur) => new Map(cur).set(id, { ...cur.get(id)!, ...p }));

  const total = totalOvertime([...rows.values()].map((r) => ({ extraMinutes: r.minutes })));
  const recovering = [...rows.entries()].reduce(
    (n, [id, r]) => n + (r.minutes > 0 && r.recovers && (pendingDelays[id] || groups.some((g) => g.members.some((m) => m.employee.id === id && m.day.extraRecovers))) ? r.minutes : 0),
    0,
  );

  const changes = () => {
    const out: { employeeId: string; extraMinutes: number; extraNote: string | null; extraRecovers: boolean }[] = [];
    for (const g of groups) {
      for (const { employee, day } of g.members) {
        const r = rows.get(employee.id);
        if (!r) continue;
        const note = r.note.trim();
        const recovers = r.minutes > 0 && r.recovers;
        if (r.minutes !== (day.extraMinutes ?? 0) || note !== (day.extraNote ?? "") || recovers !== day.extraRecovers) {
          out.push({ employeeId: employee.id, extraMinutes: r.minutes, extraNote: note || null, extraRecovers: recovers });
        }
      }
    }
    return out;
  };

  const save = async () => {
    const items = changes();
    if (items.length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    const res = await onSave(items);
    setSaving(false);
    if (res.ok) onClose();
    else setError(res.error);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Cierre de turno · Horas extra">
      <div className="flex flex-col gap-3 pb-2">
        <p className="flex items-baseline justify-between rounded-control bg-surface-2 px-3 py-2.5">
          <span className="text-[14px] text-muted">Total de la noche</span>
          <span className="text-[18px] font-semibold tabular-nums" data-testid="overtime-total">
            {total === 0 ? "0" : formatOvertime(total)}
          </span>
        </p>
        {recovering > 0 && (
          <p className="px-1 text-[13px] text-success">Incluye {formatOvertime(recovering)} que recuperan retrasos (no son horas extra).</p>
        )}
        <p className="px-1 text-[13px] text-muted">
          Por debajo de 0 es <span className="font-medium text-danger">retraso</span> (p. ej. si llega tarde): resta horas.
        </p>
        {error && (
          <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-[14px] text-danger">
            {error}
          </p>
        )}
        {groups.length === 0 && <p className="py-4 text-center text-muted">Nadie trabaja esta noche.</p>}
        {groups.map((g) => (
          <section key={g.id} aria-label={g.name}>
            <h3 className="flex items-center gap-2 py-1 text-[13px] font-semibold uppercase tracking-wide text-muted">
              {g.color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} aria-hidden />}
              {g.name}
            </h3>
            <ul className="divide-y divide-line">
              {g.members.map(({ employee, day }) => {
                const r = rows.get(employee.id)!;
                const owed = pendingDelays[employee.id];
                // El interruptor sale si debe algo o si ya estaba guardado como recuperación.
                const canRecover = r.minutes > 0 && (!!owed || day.extraRecovers);
                return (
                  <li key={employee.id} className="py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{employee.name}</span>
                        {r.suggested && (
                          <span className="block text-[12px] text-accent">Sugerido por hora de salida</span>
                        )}
                        {owed &&
                          (() => {
                            const l = owedLine(owed, r.recovers && r.minutes > 0 ? r.minutes : 0);
                            return <span className={cn("block text-[12px]", l.done ? "text-success" : "text-danger")}>{l.text}</span>;
                          })()}
                      </span>
                      <OvertimeStepper
                        compact
                        label={`Horas extra de ${employee.name}`}
                        minutes={r.minutes}
                        suggested={r.suggested}
                        onChange={(m) => patch(employee.id, { minutes: m, suggested: false })}
                      />
                      <button
                        type="button"
                        aria-label={`Motivo de ${employee.name}`}
                        aria-expanded={r.noteOpen}
                        onClick={() => patch(employee.id, { noteOpen: !r.noteOpen })}
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-[18px] active:opacity-70",
                          r.note ? "bg-accent/15" : "bg-surface-2",
                        )}
                      >
                        <span aria-hidden>💬</span>
                      </button>
                    </div>
                    {canRecover && (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={r.recovers}
                        onClick={() => patch(employee.id, { recovers: !r.recovers })}
                        className={cn(
                          "mt-1.5 flex min-h-11 w-full items-center gap-2 rounded-control px-3 text-left text-[14px] font-medium",
                          r.recovers ? "bg-success/15 text-success" : "bg-surface-2 text-muted",
                        )}
                      >
                        <span aria-hidden className="text-[16px]">↺</span>
                        <span className="flex-1">
                          {r.recovers ? "Recupera retraso (no son horas extra)" : "¿Es para recuperar el retraso?"}
                        </span>
                        <span aria-hidden>{r.recovers ? "Sí" : "No"}</span>
                      </button>
                    )}
                    {r.noteOpen && (
                      <input
                        type="text"
                        value={r.note}
                        maxLength={200}
                        placeholder="Motivo (opcional)"
                        aria-label={`Motivo de las horas extra de ${employee.name}`}
                        onChange={(e) => patch(employee.id, { note: e.target.value })}
                        className="mt-1.5 min-h-11 w-full rounded-control bg-surface-2 px-3 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="min-h-12 rounded-control bg-accent text-[17px] font-semibold text-accent-fg active:opacity-80 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </BottomSheet>
  );
}
