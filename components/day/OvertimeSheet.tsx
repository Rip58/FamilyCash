"use client";

import { useMemo, useState } from "react";
import type { ActionResult } from "@/app/actions/day";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { cn } from "@/components/ui/cn";
import { formatOvertime, proposeOvertime, totalOvertime } from "@/lib/overtime";
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
  onSave: (items: { employeeId: string; extraMinutes: number; extraNote: string | null }[]) => Promise<ActionResult>;
}

interface Row {
  minutes: number;
  note: string;
  suggested: boolean;
  noteOpen: boolean;
}

/** Cierre de turno: horas extra de todos los que trabajan esa noche. */
export function OvertimeSheet({ open, onClose, groups, shift, onSave }: OvertimeSheetProps) {
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

  const changes = () => {
    const out: { employeeId: string; extraMinutes: number; extraNote: string | null }[] = [];
    for (const g of groups) {
      for (const { employee, day } of g.members) {
        const r = rows.get(employee.id);
        if (!r) continue;
        const note = r.note.trim();
        if (r.minutes !== (day.extraMinutes ?? 0) || note !== (day.extraNote ?? "")) {
          out.push({ employeeId: employee.id, extraMinutes: r.minutes, extraNote: note || null });
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
              {g.members.map(({ employee }) => {
                const r = rows.get(employee.id)!;
                return (
                  <li key={employee.id} className="py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{employee.name}</span>
                        {r.suggested && (
                          <span className="block text-[12px] text-accent">Sugerido por hora de salida</span>
                        )}
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
