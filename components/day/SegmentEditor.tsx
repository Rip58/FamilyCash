"use client";

import { useState } from "react";
import { TimeInput } from "@/components/ui/TimeInput";
import { nextSegmentStart, segmentName, validateSegmentSpan, type ShiftTimes } from "@/lib/segments";
import type { DepartmentLite } from "@/lib/schedule";
import type { SectionLite, SegmentInput, SegmentWithId } from "./types";

const FREE = "__free";

interface FormProps {
  initial: SegmentInput;
  sections: SectionLite[];
  departments: Map<string, DepartmentLite>;
  others: SegmentWithId[];
  editingId?: string;
  shift: ShiftTimes;
  submitLabel: string;
  onSubmit: (s: SegmentInput) => void;
  onCancel: () => void;
}

function SegmentForm({ initial, sections, departments, others, editingId, shift, submitLabel, onSubmit, onCancel }: FormProps) {
  const [choice, setChoice] = useState<string>(initial.sectionId ?? (initial.label ? FREE : ""));
  const [label, setLabel] = useState(initial.label ?? "");
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [error, setError] = useState<string | null>(null);

  const general = sections.filter((s) => !s.departmentId || !departments.has(s.departmentId));
  const byDept = [...departments.values()]
    .map((d) => ({ d, items: sections.filter((s) => s.departmentId === d.id) }))
    .filter((g) => g.items.length > 0);

  const submit = () => {
    if (!choice) return setError("Elige una sección o escribe la tarea.");
    if (choice === FREE && !label.trim()) return setError("Escribe el nombre de la tarea.");
    const err = validateSegmentSpan(others, { id: editingId, start, end }, shift);
    if (err) return setError(err);
    onSubmit({
      sectionId: choice === FREE ? null : choice,
      label: choice === FREE ? label.trim() : null,
      start,
      end,
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-control bg-surface-2 p-3">
      <label className="flex flex-col gap-1 text-[13px] text-muted">
        Sección / tarea
        <select
          value={choice}
          onChange={(e) => {
            setChoice(e.target.value);
            setError(null);
          }}
          className="min-h-11 rounded-control bg-surface px-3 text-[16px] text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <option value="">Elegir…</option>
          {byDept.map((g) => (
            <optgroup key={g.d.id} label={g.d.name}>
              {g.items.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          ))}
          {general.length > 0 && (
            <optgroup label="General">
              {general.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          )}
          <option value={FREE}>Otra (texto libre)…</option>
        </select>
      </label>
      {choice === FREE && (
        <input
          type="text"
          value={label}
          maxLength={60}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ej. Reponer frescos"
          aria-label="Tarea"
          className="min-h-11 rounded-control bg-surface px-3 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        <TimeInput label="Desde" value={start} onChange={setStart} />
        <TimeInput label="Hasta" value={end} onChange={setEnd} />
      </div>
      {error && (
        <p role="alert" className="text-[14px] text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          className="min-h-11 flex-1 rounded-control bg-accent text-[16px] font-semibold text-accent-fg"
        >
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="min-h-11 rounded-control px-4 text-[16px] text-muted">
          Cancelar
        </button>
      </div>
    </div>
  );
}

interface SegmentEditorProps {
  segments: SegmentWithId[];
  sections: SectionLite[];
  departments: Map<string, DepartmentLite>;
  shift: ShiftTimes;
  busy: boolean;
  onAdd: (s: SegmentInput) => void;
  onUpdate: (id: string, s: SegmentInput) => void;
  onDelete: (id: string) => void;
}

export function SegmentEditor({ segments, sections, departments, shift, busy, onAdd, onUpdate, onDelete }: SegmentEditorProps) {
  const [mode, setMode] = useState<{ kind: "none" } | { kind: "add" } | { kind: "edit"; id: string }>({ kind: "none" });
  const names = new Map(sections.map((s) => [s.id, s.name]));
  const editing = mode.kind === "edit" ? segments.find((s) => s.id === mode.id) : undefined;

  return (
    <div className="flex flex-col gap-2">
      {segments.length === 0 && mode.kind !== "add" && (
        <p className="text-[14px] text-muted">Sin tareas registradas.</p>
      )}
      {segments.map((s) =>
        editing?.id === s.id ? (
          <SegmentForm
            key={s.id}
            initial={{ sectionId: s.sectionId, label: s.label, start: s.start, end: s.end }}
            sections={sections}
            departments={departments}
            others={segments}
            editingId={s.id}
            shift={shift}
            submitLabel="Guardar tramo"
            onSubmit={(v) => {
              onUpdate(s.id, v);
              setMode({ kind: "none" });
            }}
            onCancel={() => setMode({ kind: "none" })}
          />
        ) : (
          <div key={s.id} className="flex items-center gap-1 rounded-control bg-surface-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode({ kind: "edit", id: s.id })}
              className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 px-3 text-left text-[16px] disabled:opacity-60"
            >
              <span className="truncate">{segmentName(s, names)}</span>
              <span className="shrink-0 whitespace-nowrap tabular-nums text-muted">
                {s.start}–{s.end}
              </span>
            </button>
            <button
              type="button"
              aria-label={`Borrar tramo ${segmentName(s, names)}`}
              disabled={busy}
              onClick={() => onDelete(s.id)}
              className="min-h-11 min-w-11 shrink-0 text-[20px] text-danger disabled:opacity-60"
            >
              ×
            </button>
          </div>
        ),
      )}
      {mode.kind === "add" ? (
        <SegmentForm
          initial={{ sectionId: null, label: null, start: nextSegmentStart(segments, shift), end: shift.shiftEnd }}
          sections={sections}
          departments={departments}
          others={segments}
          shift={shift}
          submitLabel="Añadir tarea"
          onSubmit={(v) => {
            onAdd(v);
            setMode({ kind: "none" });
          }}
          onCancel={() => setMode({ kind: "none" })}
        />
      ) : (
        mode.kind === "none" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setMode({ kind: "add" })}
            className="min-h-11 self-start rounded-full px-3 text-[15px] font-medium text-accent disabled:opacity-60"
          >
            + Tarea
          </button>
        )
      )}
    </div>
  );
}
