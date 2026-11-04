"use client";

import { useState } from "react";
import type { ActionResult } from "@/app/actions/day";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { TimeInput } from "@/components/ui/TimeInput";
import { Icon, tint } from "@/components/ui/icons";
import { type AisleInfo, MAX_AISLE_NOTE, palletsDone, parsePallets } from "@/lib/aisle-format";
import { madridTime } from "@/lib/dates";

export interface AislePerson {
  id: string;
  name: string;
  /** Se le puede quitar de este departamento (hace más de uno, o está aquí por un cambio y vuelve al suyo). */
  removable: boolean;
}

export interface AisleGroup {
  id: string;
  name: string;
  color: string;
  /** Quién va en el departamento esa noche (los que trabajan en él y los que vienen a cubrirlo). */
  people: AislePerson[];
  /** Sin nadie, lo hace el grupo. */
  byGroup: boolean;
  /** Oculto con el ojo: no sale en el resumen del informe. */
  hidden: boolean;
}

/** Alguien que trabaja esta noche y se puede poner en un departamento. */
export interface AisleCandidate {
  id: string;
  name: string;
  /** Dónde está ahora ("Droguería", "Droguería + Cervezas", "Sin departamento"). */
  from: string;
}

export interface AisleSave {
  departmentId: string;
  startTime: string | null;
  palletsUp: number | null;
  palletsDown: number | null;
  palletsSurplus: number | null;
  note: string | null;
}

interface AislesSheetProps {
  open: boolean;
  onClose: () => void;
  groups: AisleGroup[];
  candidates: AisleCandidate[];
  /** Lo ya guardado, por departamento. */
  logs: Record<string, AisleInfo>;
  /** Añadir a esa persona a ese departamento (suma: puede hacer varios pasillos en la noche). */
  onAssign: (employeeId: string, departmentId: string) => void;
  /** Quitar a esa persona de ese departamento (los demás que hace se quedan). */
  onRemove: (employeeId: string, departmentId: string) => void;
  onSave: (items: AisleSave[]) => Promise<ActionResult>;
  /** Mostrar el ojo para ocultar pasillos (solo el dueño: es un ajuste de los departamentos). */
  canHide: boolean;
  onToggleHidden: (departmentId: string, hidden: boolean) => void;
}

interface Draft {
  start: string;
  up: string;
  down: string;
  surplus: string;
  note: string;
}

const fieldCls =
  "min-h-11 w-full min-w-0 rounded-control bg-surface-2 px-3 text-[17px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-accent";

const toDraft = (l?: AisleInfo): Draft => ({
  start: l?.startTime ?? "",
  up: l?.palletsUp === null || l?.palletsUp === undefined ? "" : String(l.palletsUp),
  down: l?.palletsDown === null || l?.palletsDown === undefined ? "" : String(l.palletsDown),
  surplus: l?.palletsSurplus === null || l?.palletsSurplus === undefined ? "" : String(l.palletsSurplus),
  note: l?.note ?? "",
});

/**
 * Control de pasillos: TODOS los departamentos de la noche, con su gente (y un desplegable para añadir a alguien;
 * una persona puede hacer varios pasillos en la noche), la hora a la que empezó y los palés subidos y bajados (hechos = subidos − bajados).
 */
export function AislesSheet({ open, onClose, groups, candidates, logs, onAssign, onRemove, onSave, canHide, onToggleHidden }: AislesSheetProps) {
  const [draft, setDraft] = useState<Record<string, Draft>>(() => Object.fromEntries(groups.map((g) => [g.id, toDraft(logs[g.id])])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // El ojo responde al momento; la página se refresca después y las props se ponen al día.
  const [hiddenNow, setHiddenNow] = useState<Record<string, boolean>>({});
  const isHidden = (g: AisleGroup) => hiddenNow[g.id] ?? g.hidden;
  const toggleHidden = (g: AisleGroup) => {
    const next = !isHidden(g);
    setHiddenNow((h) => ({ ...h, [g.id]: next }));
    onToggleHidden(g.id, next);
  };
  const shown = groups.filter((g) => !isHidden(g));
  const hiddenGroups = canHide ? groups.filter(isHidden) : [];

  const get = (id: string): Draft => draft[id] ?? toDraft(logs[id]);
  const set = (id: string, patch: Partial<Draft>) => setDraft((d) => ({ ...d, [id]: { ...get(id), ...patch } }));

  const changed = shown.filter((g) => {
    const a = get(g.id);
    const b = toDraft(logs[g.id]);
    return a.start !== b.start || a.up !== b.up || a.down !== b.down || a.surplus !== b.surplus || a.note.trim() !== b.note.trim();
  });
  const started = shown.filter((g) => get(g.id).start !== "").length;
  const totalDone = shown.reduce((sum, g) => sum + (palletsDone(parsePallets(get(g.id).up), parsePallets(get(g.id).down)) ?? 0), 0);

  const save = async () => {
    setSaving(true);
    setError(null);
    const r = await onSave(
      changed.map((g) => {
        const d = get(g.id);
        return { departmentId: g.id, startTime: d.start || null, palletsUp: parsePallets(d.up), palletsDown: parsePallets(d.down), palletsSurplus: parsePallets(d.surplus), note: d.note.trim() || null };
      }),
    );
    setSaving(false);
    if (r.ok) onClose();
    else setError(r.error);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Control de pasillos">
      <div className="flex flex-col gap-2 pb-6">
        <p className="text-[13px] text-muted">
          Han empezado {started} de {shown.length} · Palés hechos: <span className="font-semibold text-fg">{totalDone}</span>
        </p>
        <p className="text-[12px] leading-snug text-muted">
          Bajados sin tocar: bajan tal como subieron, no cuentan. Sobrante: se bajan por falta de sitio, cuentan como hechos.
        </p>
        {shown.map((g) => {
          const d = get(g.id);
          const done = palletsDone(parsePallets(d.up), parsePallets(d.down));
          const here = new Set(g.people.map((p) => p.id));
          const options = candidates.filter((c) => !here.has(c.id));
          return (
            <section key={g.id} className="rounded-card bg-surface p-3" style={{ borderLeft: `4px solid ${g.color}` }}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[16px] font-semibold">{g.name}</h3>
                {canHide && (
                  <button
                    type="button"
                    aria-label={`Ocultar ${g.name} del resumen`}
                    onClick={() => toggleHidden(g)}
                    className="press -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted"
                  >
                    <Icon name="eye" className="h-[22px] w-[22px]" />
                  </button>
                )}
              </div>

              <ul className="mb-2 mt-1 flex flex-wrap gap-1.5">
                {g.people.map((p) => (
                  <li
                    key={p.id}
                    className="flex min-h-9 items-center gap-1 rounded-full pl-3 text-[14px]"
                    style={{ backgroundColor: tint(g.color, 18) }}
                  >
                    {p.name}
                    {p.removable ? (
                      <button
                        type="button"
                        aria-label={`Quitar a ${p.name} de ${g.name}`}
                        onClick={() => onRemove(p.id, g.id)}
                        className="press flex h-9 w-9 items-center justify-center text-muted"
                      >
                        <Icon name="close" className="h-4 w-4" strokeWidth={2.4} />
                      </button>
                    ) : (
                      <span className="w-3" aria-hidden />
                    )}
                  </li>
                ))}
                {g.people.length === 0 && <li className="py-1.5 text-[14px] text-muted">{g.byGroup ? "Lo hace el grupo" : "Sin nadie"}</li>}
              </ul>

              <select
                aria-label={`Poner a alguien en ${g.name}`}
                value=""
                onChange={(e) => e.target.value && onAssign(e.target.value, g.id)}
                className={`${fieldCls} mb-2 text-[16px]`}
              >
                <option value="">{g.people.length === 0 ? "Poner a alguien aquí…" : "Añadir a alguien…"}</option>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.from}
                  </option>
                ))}
              </select>

              <div className="flex items-end gap-2">
                <TimeInput label="Empezó a las" value={d.start} onChange={(v) => set(g.id, { start: v })} clearable className="flex-1" />
                <button
                  type="button"
                  onClick={() => set(g.id, { start: madridTime(new Date()) })}
                  className="press min-h-11 shrink-0 rounded-control px-3.5 text-[15px] font-semibold text-accent"
                  style={{ backgroundColor: tint(g.color, 18) }}
                >
                  Ahora
                </button>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2">
                {(
                  [
                    ["up", "Subidos"],
                    ["down", "Bajados sin tocar"],
                    ["surplus", "Sobrante"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex flex-col justify-end gap-1 text-[13px] leading-tight text-muted">
                    {label}
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={3}
                      value={d[key]}
                      onChange={(e) => set(g.id, { [key]: e.target.value.replace(/\D/g, "") })}
                      className={fieldCls}
                    />
                  </label>
                ))}
              </div>
              <input
                aria-label={`Nota de ${g.name}`}
                placeholder="Nota (se ha encontrado mal, no ha podido hacer más…)"
                maxLength={MAX_AISLE_NOTE}
                value={d.note}
                onChange={(e) => set(g.id, { note: e.target.value })}
                className={`${fieldCls} mt-2 text-[16px]`}
              />
              {done !== null && (
                <p className="mt-1.5 text-[14px]">
                  Hechos: <span className="font-semibold">{done}</span>
                </p>
              )}
            </section>
          );
        })}
        {hiddenGroups.length > 0 && (
          <section aria-label="Pasillos ocultos" className="rounded-card bg-surface px-3 py-2">
            <h3 className="text-[13px] font-semibold text-muted">Ocultos del resumen · {hiddenGroups.length}</h3>
            <ul>
              {hiddenGroups.map((g) => (
                <li key={g.id} className="flex min-h-11 items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-[15px] text-muted">
                    <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: g.color }} />
                    <span className="truncate">{g.name}</span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Mostrar ${g.name} en el resumen`}
                    onClick={() => toggleHidden(g)}
                    className="press flex h-11 items-center gap-1.5 rounded-control px-3 text-[14px] font-semibold text-accent"
                  >
                    <Icon name="eyeOff" className="h-5 w-5" />
                    Mostrar
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {error && (
          <p role="alert" className="text-[14px] text-danger">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={saving || changed.length === 0}
          onClick={() => void save()}
          className="press mt-1 min-h-12 rounded-control bg-accent text-[16px] font-semibold text-accent-fg disabled:opacity-40"
        >
          {saving ? "Guardando…" : changed.length > 0 ? `Guardar (${changed.length})` : "Guardar"}
        </button>
        <p className="text-[12px] text-muted">
          Los cambios de personal y el ojo se guardan al momento; la hora, los palés y las notas, al pulsar Guardar.
        </p>
      </div>
    </BottomSheet>
  );
}
