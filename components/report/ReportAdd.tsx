"use client";

import { useState, useTransition } from "react";
import { addNightNote, deleteNightNote } from "@/app/actions/notes";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { DateStr } from "@/lib/dates";

const fieldClass =
  "w-full rounded-control bg-surface-2 px-3 text-[16px] outline-none focus:ring-2 focus:ring-accent";

/** Botón "+ Nota de la noche": varias notas por noche, generales o de un empleado. */
export function ReportAdd({ date, employees }: { date: DateStr; employees: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(0);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setN((x) => x + 1);
          setOpen(true);
        }}
        className="flex min-h-12 w-full items-center justify-center rounded-card bg-surface px-3 text-[16px] font-semibold text-accent active:opacity-70"
      >
        + Nota de la noche
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Nota de la noche">
        {open && <NoteForm key={n} date={date} employees={employees} onDone={() => setOpen(false)} />}
      </BottomSheet>
    </>
  );
}

function NoteForm({ date, employees, onDone }: { date: DateStr; employees: { id: string; name: string }[]; onDone: () => void }) {
  const [employeeId, setEmployeeId] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3 pb-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-muted">¿Sobre quién?</span>
        <select
          aria-label="Empleado"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className={`${fieldClass} min-h-11`}
        >
          <option value="">General (toda la noche)</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-muted">Nota</span>
        <textarea
          aria-label="Nota"
          value={text}
          maxLength={1000}
          onChange={(e) => setText(e.target.value)}
          placeholder={employeeId ? "¿Qué hay que notificar de esta persona?" : "Ej.: han llegado todos a la hora…"}
          className={`${fieldClass} min-h-[120px] py-2`}
        />
      </label>
      {error && (
        <p role="alert" className="text-[14px] text-danger">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={pending || !text.trim()}
        onClick={() =>
          start(async () => {
            const r = await addNightNote({ date, employeeId: employeeId || null, text });
            if (r.ok) onDone();
            else setError(r.error);
          })
        }
        className="min-h-11 rounded-control bg-accent text-[16px] font-semibold text-accent-fg disabled:opacity-40"
      >
        {pending ? "Guardando…" : "Añadir nota"}
      </button>
    </div>
  );
}

/** Botón para borrar una nota de la noche (con confirmación). */
export function DeleteNoteButton({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return confirm ? (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (await deleteNightNote(id)))}
      className="min-h-11 shrink-0 rounded-full px-3 text-[13px] font-semibold text-danger"
    >
      ¿Borrar?
    </button>
  ) : (
    <button
      type="button"
      aria-label="Borrar nota"
      onClick={() => setConfirm(true)}
      className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-[18px] text-muted"
    >
      ×
    </button>
  );
}
