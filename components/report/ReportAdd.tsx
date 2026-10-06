"use client";

import { useState, useTransition } from "react";
import { addNightNote, deleteNightNote, setNoteDone, updateNightNote } from "@/app/actions/notes";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icons";
import { reportIconBtn } from "./header-button";
import type { DateStr } from "@/lib/dates";

const fieldClass =
  "w-full rounded-control bg-surface-2 px-3 text-[16px] outline-none focus:ring-2 focus:ring-accent";

type Opt = { id: string; name: string };

/** Botón (icono de nota) "Nota de la noche": varias notas por noche (informativas o tareas), generales o de un empleado. */
export function ReportAdd({ date, employees, departments }: { date: DateStr; employees: Opt[]; departments: Opt[] }) {
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
        aria-label="Añadir nota de la noche"
        className={reportIconBtn}
      >
        <Icon name="note" className="h-[22px] w-[22px]" strokeWidth={2.2} />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Nota de la noche">
        {open && (
          <NoteForm key={n} date={date} employees={employees} departments={departments} onDone={() => setOpen(false)} />
        )}
      </BottomSheet>
    </>
  );
}

export interface EditableNote {
  id: string;
  kind: "INFO" | "TASK";
  employeeId: string | null;
  departmentId: string | null;
  text: string;
}

function NoteForm({
  date,
  employees,
  departments,
  initial,
  onDone,
}: {
  date: DateStr;
  employees: Opt[];
  departments: Opt[];
  /** Con nota: se edita esa nota en vez de añadir una nueva. */
  initial?: EditableNote;
  onDone: () => void;
}) {
  const [kind, setKind] = useState<"INFO" | "TASK">(initial?.kind ?? "INFO");
  const [employeeId, setEmployeeId] = useState(initial?.employeeId ?? "");
  const [departmentId, setDepartmentId] = useState(initial?.departmentId ?? "");
  const [text, setText] = useState(initial?.text ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3 pb-2">
      <Segmented
        aria-label="Tipo de nota"
        value={kind}
        onChange={setKind}
        options={[
          { value: "INFO", label: "📝 Informativa" },
          { value: "TASK", label: "☐ Tarea" },
        ]}
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-muted">Empleado (opcional)</span>
        <select aria-label="Empleado" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={`${fieldClass} min-h-11`}>
          <option value="">General (ninguno)</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-muted">Departamento (opcional)</span>
        <select
          aria-label="Departamento"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className={`${fieldClass} min-h-11`}
        >
          <option value="">—</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-muted">{kind === "TASK" ? "Tarea" : "Nota"}</span>
        <textarea
          aria-label="Nota"
          value={text}
          maxLength={1000}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            kind === "TASK" ? "Ej.: apuntar sus horas extra en el Excel…" : employeeId ? "¿Qué ha pasado con esta persona?" : "Ej.: han llegado todos a la hora…"
          }
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
            const fields = { employeeId: employeeId || null, departmentId: departmentId || null, kind, text };
            const r = initial ? await updateNightNote({ id: initial.id, ...fields }) : await addNightNote({ date, ...fields });
            if (r.ok) onDone();
            else setError(r.error);
          })
        }
        className="min-h-11 rounded-control bg-accent text-[16px] font-semibold text-accent-fg disabled:opacity-40"
      >
        {pending ? "Guardando…" : initial ? "Guardar cambios" : kind === "TASK" ? "Añadir tarea" : "Añadir nota"}
      </button>
    </div>
  );
}

/** Toca la nota para editarla (texto, tipo, empleado o departamento). */
export function EditNoteButton({
  date,
  note,
  employees,
  departments,
  children,
}: {
  date: DateStr;
  note: EditableNote;
  employees: Opt[];
  departments: Opt[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(0);
  // Si el empleado ya no está activo, se mantiene en la lista para no perderlo al guardar.
  const people = note.employeeId && !employees.some((e) => e.id === note.employeeId) ? [{ id: note.employeeId, name: "(empleado de la nota)" }, ...employees] : employees;
  return (
    <>
      <button
        type="button"
        aria-label="Editar nota"
        onClick={() => {
          setN((x) => x + 1);
          setOpen(true);
        }}
        className="min-w-0 flex-1 rounded-control pt-0.5 text-left active:bg-surface-2"
      >
        {children}
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={note.kind === "TASK" ? "Editar tarea" : "Editar nota"}>
        {open && (
          <NoteForm key={n} date={date} employees={people} departments={departments} initial={note} onDone={() => setOpen(false)} />
        )}
      </BottomSheet>
    </>
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
