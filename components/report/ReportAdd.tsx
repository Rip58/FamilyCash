"use client";

import { useState, useTransition } from "react";
import { setDayNote, setNote } from "@/app/actions/day";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { DateStr } from "@/lib/dates";

export interface ReportAddEmployee {
  id: string;
  name: string;
  note: string | null;
}

const textareaClass =
  "min-h-[140px] w-full rounded-control bg-surface-2 px-3 py-2 text-[16px] outline-none focus:ring-2 focus:ring-accent";
const addBtn =
  "flex min-h-12 flex-1 items-center justify-center rounded-card bg-surface px-3 text-[15px] font-semibold text-accent active:opacity-70";

function NoteEditor({
  label,
  initial,
  placeholder,
  maxLength,
  onSave,
}: {
  label: string;
  initial: string;
  placeholder: string;
  maxLength: number;
  onSave: (text: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3 pb-2">
      <textarea
        aria-label={label}
        value={text}
        maxLength={maxLength}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        autoFocus
        className={textareaClass}
      />
      {error && (
        <p role="alert" className="text-[14px] text-danger">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={pending || text === initial}
        onClick={() =>
          start(async () => {
            const r = await onSave(text);
            if (!r.ok) setError(r.error ?? "No se pudo guardar.");
          })
        }
        className="min-h-11 rounded-control bg-accent text-[16px] font-semibold text-accent-fg disabled:opacity-40"
      >
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );
}

/** Botones "+ Añadir" del informe diario: nota de la noche y nota sobre un empleado. */
export function ReportAdd({
  date,
  dayNote,
  employees,
}: {
  date: DateStr;
  dayNote: string | null;
  employees: ReportAddEmployee[];
}) {
  const [nightOpen, setNightOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [editing, setEditing] = useState<ReportAddEmployee | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLocaleLowerCase("es");
  const list = employees.filter((e) => !q || e.name.toLocaleLowerCase("es").includes(q));

  return (
    <>
      <div className="flex gap-2">
        <button type="button" onClick={() => setNightOpen(true)} className={addBtn}>
          + Nota de la noche
        </button>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setPickOpen(true);
          }}
          className={addBtn}
        >
          + Nota de empleado
        </button>
      </div>

      <BottomSheet open={nightOpen} onClose={() => setNightOpen(false)} title="Nota de la noche">
        {nightOpen && (
          <NoteEditor
            label="Nota general de la noche"
            initial={dayNote ?? ""}
            maxLength={1000}
            placeholder="¿Algo especial esta noche? Incidencias, recordatorios…"
            onSave={async (text) => {
              const r = await setDayNote({ date, text });
              if (r.ok) setNightOpen(false);
              return r;
            }}
          />
        )}
      </BottomSheet>

      <BottomSheet open={pickOpen} onClose={() => setPickOpen(false)} title="¿Sobre quién?">
        {pickOpen && (
          <div className="pb-2">
            <input
              type="search"
              aria-label="Buscar empleado"
              placeholder="Buscar empleado"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-11 w-full rounded-control bg-surface-2 px-3 text-[17px] outline-none focus:ring-2 focus:ring-accent"
            />
            <ul className="mt-2">
              {list.map((e) => (
                <li key={e.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(e);
                      setPickOpen(false);
                      setEditOpen(true);
                    }}
                    className="flex min-h-12 w-full items-center gap-3 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px]">{e.name}</span>
                      {e.note && <span className="block truncate text-[13px] text-muted">💬 {e.note}</span>}
                    </span>
                    <span className="text-muted" aria-hidden>
                      ›
                    </span>
                  </button>
                </li>
              ))}
              {list.length === 0 && <li className="py-4 text-center text-muted">Ningún empleado coincide.</li>}
            </ul>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={editOpen} onClose={() => setEditOpen(false)} title={editing ? `Nota · ${editing.name}` : "Nota"}>
        {editing && editOpen && (
          <NoteEditor
            key={editing.id}
            label={`Nota sobre ${editing.name}`}
            initial={editing.note ?? ""}
            maxLength={500}
            placeholder="¿Qué hay que notificar de esta persona?"
            onSave={async (text) => {
              const r = await setNote({ employeeId: editing.id, date, note: text.trim() || null });
              if (r.ok) setEditOpen(false);
              return r;
            }}
          />
        )}
      </BottomSheet>
    </>
  );
}
