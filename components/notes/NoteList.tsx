"use client";

import { useState, useTransition } from "react";
import { setNoteDone } from "@/app/actions/notes";
import { PhotoThumbs } from "@/components/reports/PhotoThumbs";
import { PhotoViewer } from "@/components/reports/PhotoViewer";
import { cn } from "@/components/ui/cn";
import { tint } from "@/components/ui/icons";
import { NOTE_TYPE_META, type NoteView, groupNotesByWho, noteLabel } from "@/lib/notes";
import { type NoteDefaults, type NoteOptions, NoteSheet } from "./NoteSheet";

/**
 * Notas de una noche (o de una persona): tocar una nota la abre para editar o borrar; las tareas tienen casilla.
 * Con `showWho`, las de la misma persona (o departamento) van juntas bajo su nombre; `false` cuando la lista ya es
 * de una sola persona.
 */
export function NoteList({
  notes,
  options,
  defaults,
  showWho = true,
  compact,
}: {
  notes: NoteView[];
  options: NoteOptions;
  defaults: NoteDefaults;
  showWho?: boolean;
  /** Texto en 2 líneas como mucho (Hoy). */
  compact?: boolean;
}) {
  const [editing, setEditing] = useState<{ note: NoteView; open: boolean } | null>(null);
  if (notes.length === 0) return null;
  return (
    <>
      {showWho ? (
        <ul className="divide-y divide-line">
          {groupNotesByWho(notes).map((g) => (
            <li key={g.key} className={compact ? "py-1" : "py-1.5"}>
              <h3 className="pt-1 text-[12px] font-semibold leading-tight text-fg/80">
                {g.who}
                {g.notes.length > 1 && <span className="font-normal text-muted"> · {g.notes.length}</span>}
              </h3>
              <ul>
                {g.notes.map((n) => (
                  <NoteRow
                    key={n.id}
                    note={n}
                    place={g.key.startsWith("dep:") || g.key === "general" ? null : n.departmentName}
                    compact={compact}
                    onEdit={() => setEditing({ note: n, open: true })}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="divide-y divide-line">
          {notes.map((n) => (
            <NoteRow key={n.id} note={n} place={n.departmentName} compact={compact} onEdit={() => setEditing({ note: n, open: true })} />
          ))}
        </ul>
      )}
      <NoteSheet
        open={!!editing?.open}
        onClose={() => setEditing((e) => (e ? { ...e, open: false } : e))}
        note={editing?.note}
        defaults={defaults}
        options={options}
      />
    </>
  );
}

function NoteRow({ note, place, compact, onEdit }: { note: NoteView; place: string | null; compact?: boolean; onEdit: () => void }) {
  const [viewer, setViewer] = useState<number | null>(null);
  const meta = NOTE_TYPE_META[note.type];
  const task = note.type === "TASK";
  const tagged = note.type !== "NOTE" || !!place || !!note.sectionName || !!note.time;
  return (
    <li className={cn("flex items-start gap-1", compact ? "py-0" : "py-0.5", task && !note.done && "-mx-2 rounded-control bg-warning/10 px-2")}>
      {task && <TaskCheck id={note.id} done={note.done} label={note.text} />}
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onEdit} aria-label={`Editar: ${note.text}`} className="block w-full rounded-control py-1 text-left active:bg-surface-2">
          {tagged && (
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] leading-tight text-muted">
              {note.type !== "NOTE" && (
                <span className="rounded px-1.5 py-px text-[11px] font-semibold uppercase tracking-wide" style={{ backgroundColor: tint(meta.color, 16), color: meta.color }}>
                  {noteLabel(note)}
                </span>
              )}
              {place && <span>{place}</span>}
              {note.sectionName && <span>· {note.sectionName}</span>}
              {note.time && <span className="tabular-nums">· {note.time}</span>}
            </span>
          )}
          <span
            className={cn(
              "mt-0.5 block whitespace-pre-wrap break-words leading-snug",
              compact ? "line-clamp-2 text-[14px]" : "text-[15px]",
              task && note.done && "text-muted line-through",
            )}
          >
            {note.text}
          </span>
        </button>
        {note.photos.length > 0 && (
          <>
            <PhotoThumbs photos={note.photos} onOpen={setViewer} label="Fotos de la nota" />
            <PhotoViewer photos={note.photos} index={viewer} caption={`${note.employeeName ? `${note.employeeName}: ` : ""}${note.text}`} onClose={() => setViewer(null)} />
          </>
        )}
      </div>
    </li>
  );
}

/** Casilla de tarea hecha / pendiente. */
export function TaskCheck({ id, done, label }: { id: string; done: boolean; label: string }) {
  const [optimistic, setOptimistic] = useState(done);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={optimistic}
      aria-label={`${optimistic ? "Hecha" : "Pendiente"}: ${label}`}
      disabled={pending}
      onClick={() => {
        const next = !optimistic;
        setOptimistic(next);
        start(async () => {
          const r = await setNoteDone({ id, done: next });
          if (!r.ok) setOptimistic(!next);
        });
      }}
      className="flex min-h-11 min-w-11 shrink-0 items-center justify-center"
    >
      <span
        aria-hidden
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-[7px] border-2 text-[14px] font-bold",
          optimistic ? "border-success bg-success text-white" : "border-warning",
        )}
      >
        {optimistic && "✓"}
      </span>
    </button>
  );
}

/** Botón «+ Nota» que abre la hoja con lo que ya se sabe (persona, departamento, noche). */
export function AddNoteButton({
  defaults,
  options,
  className,
  children = "+ Nota",
  ariaLabel,
}: {
  defaults: NoteDefaults;
  options: NoteOptions;
  className?: string;
  children?: React.ReactNode;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-label={ariaLabel} onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <NoteSheet open={open} onClose={() => setOpen(false)} defaults={defaults} options={options} />
    </>
  );
}
