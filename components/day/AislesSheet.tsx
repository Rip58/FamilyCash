"use client";

import { useState } from "react";
import type { ActionResult } from "@/app/actions/day";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Icon, tint } from "@/components/ui/icons";
import { type AisleInfo, MAX_AISLE_NOTE, palletsDone, parsePallets } from "@/lib/aisle-format";
import { madridTime } from "@/lib/dates";

export interface AislePerson {
  id: string;
  name: string;
  /** Se le puede quitar de este departamento (hace más de uno, o está aquí por un cambio y vuelve al suyo). */
  removable: boolean;
}

/** Una fila del control: un departamento, o un pasillo separado dentro de él (Leche, Café…). */
export interface AisleGroup {
  /** `aisleKey`: departamento o departamento:sección. */
  key: string;
  departmentId: string;
  sectionId: string | null;
  name: string;
  /** Departamento, si es un pasillo separado. */
  parent: string | null;
  color: string;
  /** "department": la gente sale de los puestos de la noche (`people`); "list": se apunta aquí, en este pasillo. */
  mode: "department" | "list";
  people: AislePerson[];
  /** Sin nadie, lo hace el grupo. */
  byGroup: boolean;
  /** Oculto con el ojo esta noche: no sale en el resumen del informe. */
  hidden: boolean;
}

/** Alguien presente esta noche que se puede añadir a un pasillo (solo se muestra el nombre). */
export interface AisleCandidate {
  id: string;
  name: string;
}

export interface AisleSave {
  departmentId: string;
  sectionId: string | null;
  employeeIds: string[];
  startTime: string | null;
  endTime: string | null;
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
  /** Nombre de cada empleado (para las personas apuntadas en un pasillo separado). */
  names: Record<string, string>;
  /** Lo ya guardado, por clave de pasillo. */
  logs: Record<string, AisleInfo>;
  /** Añadir a esa persona a ese departamento (suma: puede hacer varios pasillos en la noche). */
  onAssign: (employeeId: string, departmentId: string) => void;
  /** Quitar a esa persona de ese departamento (los demás que hace se quedan). */
  onRemove: (employeeId: string, departmentId: string) => void;
  onSave: (items: AisleSave[]) => Promise<ActionResult>;
  /** El ojo: oculta el pasillo SOLO esta noche. */
  onToggleHidden: (departmentId: string, sectionId: string | null, hidden: boolean) => void;
  /** Abre la hoja de notas (la misma de Hoy) para apuntar una nota general de la noche. */
  onAddNote: () => void;
}

interface Draft {
  start: string;
  end: string;
  up: string;
  down: string;
  surplus: string;
  note: string;
  /** Personas del pasillo (solo en los separados). */
  people: string[];
}

const num = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
const toDraft = (l?: AisleInfo): Draft => ({
  start: l?.startTime ?? "",
  end: l?.endTime ?? "",
  up: num(l?.palletsUp),
  down: num(l?.palletsDown),
  surplus: num(l?.palletsSurplus),
  note: l?.note ?? "",
  people: l?.employeeIds ?? [],
});

const same = (a: Draft, b: Draft) =>
  a.start === b.start &&
  a.end === b.end &&
  a.up === b.up &&
  a.down === b.down &&
  a.surplus === b.surplus &&
  a.note.trim() === b.note.trim() &&
  a.people.length === b.people.length &&
  a.people.every((p, i) => p === b.people[i]);

const field =
  "h-10 w-full min-w-0 rounded-control bg-surface-2 px-2.5 text-[15px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-accent";
const tiny = "press h-6 rounded px-1.5 text-[12px] font-semibold";

/** Etiqueta de un campo de la tarjeta (11 px) con acciones pequeñas a la derecha. */
function Label({ children, actions }: { children: string; actions?: React.ReactNode }) {
  return (
    <span className="flex h-6 items-center justify-between text-[11px] font-medium text-muted">
      {children}
      {actions && <span className="flex items-center">{actions}</span>}
    </span>
  );
}

/**
 * Control de pasillos, en módulos pequeños como el resto de la app: una tarjeta por pasillo (cabecera de 32 px con el
 * nombre, los palés hechos y el ojo; debajo la gente, las dos horas, los tres palés y una nota). Un departamento se
 * puede separar en pasillos (Leche, Café…) en Ajustes → Secciones.
 */
export function AislesSheet({ open, onClose, groups, candidates, names, logs, onAssign, onRemove, onSave, onToggleHidden, onAddNote }: AislesSheetProps) {
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // El ojo responde al momento; la página se refresca después y las props se ponen al día.
  const [hiddenNow, setHiddenNow] = useState<Record<string, boolean>>({});

  const get = (g: AisleGroup): Draft => draft[g.key] ?? toDraft(logs[g.key]);
  const set = (g: AisleGroup, patch: Partial<Draft>) => setDraft((d) => ({ ...d, [g.key]: { ...get(g), ...patch } }));
  const isHidden = (g: AisleGroup) => hiddenNow[g.key] ?? g.hidden;
  const toggleHidden = (g: AisleGroup) => {
    const next = !isHidden(g);
    setHiddenNow((h) => ({ ...h, [g.key]: next }));
    onToggleHidden(g.departmentId, g.sectionId, next);
  };

  const shown = groups.filter((g) => !isHidden(g));
  const hiddenGroups = groups.filter(isHidden);
  const changed = shown.filter((g) => !same(get(g), toDraft(logs[g.key])));
  const withData = shown.filter((g) => {
    const d = get(g);
    return d.start !== "" || d.end !== "" || d.up !== "" || d.down !== "" || d.surplus !== "";
  }).length;
  const totalDone = shown.reduce((n, g) => n + (palletsDone(parsePallets(get(g).up), parsePallets(get(g).down)) ?? 0), 0);

  const save = async () => {
    setSaving(true);
    setError(null);
    const r = await onSave(
      changed.map((g) => {
        const d = get(g);
        return {
          departmentId: g.departmentId,
          sectionId: g.sectionId,
          employeeIds: g.mode === "list" ? d.people : [],
          startTime: d.start || null,
          endTime: d.end || null,
          palletsUp: parsePallets(d.up),
          palletsDown: parsePallets(d.down),
          palletsSurplus: parsePallets(d.surplus),
          note: d.note.trim() || null,
        };
      }),
    );
    setSaving(false);
    if (r.ok) onClose();
    else setError(r.error);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Control de pasillos">
      <div className="flex flex-col gap-2 pb-2">
        <p className="px-1 text-[13px] text-muted">
          Con datos: {withData} de {shown.length} · Palés hechos: <span className="font-semibold text-fg">{totalDone}</span>
        </p>
        <p className="px-1 text-[12px] leading-snug text-muted">
          Sin tocar: bajan tal como subieron, no cuentan. Sobrante: se bajan por falta de sitio, cuentan como hechos.
        </p>

        {shown.map((g) => {
          const d = get(g);
          const done = palletsDone(parsePallets(d.up), parsePallets(d.down));
          // Personas del pasillo: las de los puestos de la noche (departamento) o las apuntadas aquí (pasillo separado).
          const people: AislePerson[] =
            g.mode === "list"
              ? d.people.map((id) => ({ id, name: names[id] ?? "?", removable: true }))
              : g.people;
          const here = new Set(people.map((p) => p.id));
          const options = candidates.filter((c) => !here.has(c.id));
          return (
            <section key={g.key} aria-label={g.name} className="overflow-hidden rounded-card bg-surface">
              <header className="flex h-8 items-center gap-2 pl-3 pr-1" style={{ backgroundColor: tint(g.color, 18) }}>
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: g.color }} />
                <h3 className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                  {g.name}
                  {g.parent && <span className="font-normal text-muted"> · {g.parent}</span>}
                </h3>
                {done !== null && <span className="text-[12px] font-semibold tabular-nums text-success">{done} hechos</span>}
                <button
                  type="button"
                  aria-label={`Ocultar ${g.name} esta noche`}
                  onClick={() => toggleHidden(g)}
                  className="press -my-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted"
                >
                  <Icon name="eye" className="h-5 w-5" />
                </button>
              </header>

              <div className="space-y-1 p-2">
                <div className="flex flex-wrap items-center gap-1">
                  {people.map((p) => (
                    <span key={p.id} className="flex h-8 items-center rounded-full pl-2.5 text-[13px]" style={{ backgroundColor: tint(g.color, 14) }}>
                      {p.name}
                      {p.removable ? (
                        <button
                          type="button"
                          aria-label={`Quitar a ${p.name} de ${g.name}`}
                          onClick={() => (g.mode === "list" ? set(g, { people: d.people.filter((x) => x !== p.id) }) : onRemove(p.id, g.departmentId))}
                          className="press flex h-8 w-7 items-center justify-center text-muted"
                        >
                          <Icon name="close" className="h-3.5 w-3.5" strokeWidth={2.4} />
                        </button>
                      ) : (
                        <span className="w-2.5" aria-hidden />
                      )}
                    </span>
                  ))}
                  {people.length === 0 && <span className="px-1 text-[13px] text-muted">{g.byGroup ? "Lo hace el grupo" : "Sin nadie"}</span>}
                  <select
                    aria-label={`Añadir a alguien en ${g.name}`}
                    value=""
                    onChange={(e) => {
                      const id = e.target.value;
                      if (!id) return;
                      if (g.mode === "list") set(g, { people: [...d.people, id] });
                      else onAssign(id, g.departmentId);
                    }}
                    className="h-8 rounded-full bg-surface-2 px-3 text-[13px] font-semibold text-accent outline-none"
                  >
                    <option value="">+ Añadir</option>
                    {options.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-1.5">
                  {(
                    [
                      ["start", "Empezó"],
                      ["end", "Acabó"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block min-w-0">
                      <Label
                        actions={
                          <>
                            {d[key] && (
                              <button type="button" aria-label={`Borrar hora de ${label.toLowerCase()}`} onClick={() => set(g, { [key]: "" })} className={`${tiny} text-muted`}>
                                ✕
                              </button>
                            )}
                            <button type="button" onClick={() => set(g, { [key]: madridTime(new Date()) })} className={`${tiny} text-accent`}>
                              Ahora
                            </button>
                          </>
                        }
                      >
                        {label}
                      </Label>
                      <input
                        type="time"
                        step={60}
                        value={d[key]}
                        onChange={(e) => set(g, { [key]: e.target.value })}
                        aria-label={`${label} a las (${g.name})`}
                        className={`${field} block max-w-full appearance-none text-left`}
                      />
                    </label>
                  ))}
                </div>

                <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-1.5">
                  {(
                    [
                      ["up", "Subidos"],
                      ["down", "Sin tocar"],
                      ["surplus", "Sobrante"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block min-w-0">
                      <Label>{label}</Label>
                      <input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={3}
                        value={d[key]}
                        onChange={(e) => set(g, { [key]: e.target.value.replace(/\D/g, "") })}
                        aria-label={`${label} (${g.name})`}
                        className={field}
                      />
                    </label>
                  ))}
                </div>

                {/* Se agranda sola según se escribe (hasta MAX_AISLE_NOTE caracteres). */}
                <textarea
                  aria-label={`Nota de ${g.name}`}
                  placeholder="Nota (opcional)"
                  maxLength={MAX_AISLE_NOTE}
                  rows={1}
                  value={d.note}
                  ref={(el) => {
                    if (el) {
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }
                  }}
                  onChange={(e) => set(g, { note: e.target.value })}
                  className="block min-h-10 w-full resize-none rounded-control bg-surface-2 px-2.5 py-2 text-[15px] leading-snug outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
                {d.note.length > MAX_AISLE_NOTE * 0.8 && (
                  <p className="px-1 text-right text-[11px] tabular-nums text-muted">
                    {d.note.length}/{MAX_AISLE_NOTE}
                  </p>
                )}
              </div>
            </section>
          );
        })}

        {hiddenGroups.length > 0 && (
          <section aria-label="Pasillos ocultos" className="rounded-card bg-surface px-3 py-1.5">
            <h3 className="text-[12px] font-semibold text-muted">Ocultos esta noche · {hiddenGroups.length}</h3>
            <ul>
              {hiddenGroups.map((g) => (
                <li key={g.key} className="flex min-h-11 items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-[14px] text-muted">
                    <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: g.color }} />
                    <span className="truncate">
                      {g.name}
                      {g.parent && ` · ${g.parent}`}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Mostrar ${g.name} en el resumen`}
                    onClick={() => toggleHidden(g)}
                    className="press flex h-11 items-center gap-1.5 rounded-control px-2 text-[13px] font-semibold text-accent"
                  >
                    <Icon name="eyeOff" className="h-[18px] w-[18px]" />
                    Mostrar
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <button
          type="button"
          onClick={onAddNote}
          className="press flex min-h-11 items-center justify-center gap-1.5 rounded-card bg-surface-2 text-[15px] font-semibold text-accent"
        >
          <Icon name="note" className="h-5 w-5" />
          Añadir nota general
        </button>

        {error && (
          <p role="alert" className="px-1 text-[14px] text-danger">
            {error}
          </p>
        )}
        <p className="px-1 text-[11px] text-muted">
          Los cambios de personal en un departamento y el ojo (solo esta noche) se guardan al momento; lo demás, al pulsar Guardar.
        </p>
      </div>
      <div className="sticky bottom-[calc(-16px-env(safe-area-inset-bottom))] -mx-4 border-t border-line bg-surface px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          disabled={saving || changed.length === 0}
          onClick={() => void save()}
          className="press min-h-12 w-full rounded-control bg-accent text-[16px] font-semibold text-accent-fg disabled:opacity-40"
        >
          {saving ? "Guardando…" : changed.length > 0 ? `Guardar (${changed.length})` : "Guardar"}
        </button>
      </div>
    </BottomSheet>
  );
}
