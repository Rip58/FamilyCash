"use client";

import { useState } from "react";
import type { ActionResult } from "@/app/actions/day";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { TimeInput } from "@/components/ui/TimeInput";
import { tint } from "@/components/ui/icons";
import { madridTime } from "@/lib/dates";

export interface AisleGroup {
  id: string;
  name: string;
  color: string;
  /** Quién va en el departamento esa noche (los que trabajan en él y los que vienen a cubrirlo). */
  people: string[];
  /** Sin nadie, lo hace el grupo. */
  byGroup: boolean;
}

interface AislesSheetProps {
  open: boolean;
  onClose: () => void;
  groups: AisleGroup[];
  /** Hora de inicio ya guardada, por departamento. */
  starts: Record<string, string>;
  onSave: (items: { departmentId: string; startTime: string | null }[]) => Promise<ActionResult>;
}

/** Control de pasillos: cada departamento de la noche con su gente y la hora a la que ha empezado. */
export function AislesSheet({ open, onClose, groups, starts, onSave }: AislesSheetProps) {
  const [draft, setDraft] = useState<Record<string, string>>(starts);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = groups.filter((g) => (draft[g.id] ?? "") !== (starts[g.id] ?? ""));
  const started = groups.filter((g) => (draft[g.id] ?? "") !== "").length;

  const save = async () => {
    setSaving(true);
    setError(null);
    const r = await onSave(changed.map((g) => ({ departmentId: g.id, startTime: draft[g.id] || null })));
    setSaving(false);
    if (r.ok) onClose();
    else setError(r.error);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Control de pasillos">
      <div className="flex flex-col gap-2 pb-6">
        <p className="text-[13px] text-muted">
          Pasillos que han empezado: {started} de {groups.length}
        </p>
        {groups.length === 0 && <p className="py-6 text-center text-[15px] text-muted">Esta noche no hay departamentos con personal.</p>}
        {groups.map((g) => (
          <section key={g.id} className="rounded-card bg-surface p-3" style={{ borderLeft: `4px solid ${g.color}` }}>
            <h3 className="text-[16px] font-semibold">{g.name}</h3>
            <p className="mb-2 mt-0.5 text-[14px] leading-snug text-muted">
              {g.people.length > 0 ? g.people.join(", ") : g.byGroup ? "Lo hace el grupo" : "Sin nadie"}
            </p>
            <div className="flex items-end gap-2">
              <TimeInput
                label="Empezó a las"
                value={draft[g.id] ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, [g.id]: v }))}
                clearable
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, [g.id]: madridTime(new Date()) }))}
                className="press min-h-11 shrink-0 rounded-control px-3.5 text-[15px] font-semibold text-accent"
                style={{ backgroundColor: tint(g.color, 18) }}
              >
                Ahora
              </button>
            </div>
          </section>
        ))}
        {error && <p role="alert" className="text-[14px] text-danger">{error}</p>}
        <button
          type="button"
          disabled={saving || changed.length === 0}
          onClick={() => void save()}
          className="press mt-1 min-h-12 rounded-control bg-accent text-[16px] font-semibold text-accent-fg disabled:opacity-40"
        >
          {saving ? "Guardando…" : changed.length > 0 ? `Guardar (${changed.length})` : "Guardar"}
        </button>
      </div>
    </BottomSheet>
  );
}
