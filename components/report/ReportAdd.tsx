"use client";

import { useState, useTransition } from "react";
import { addNightNote, deleteNightNote, setNoteDone } from "@/app/actions/notes";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/components/ui/cn";
import type { DateStr } from "@/lib/dates";

const fieldClass =
  "w-full rounded-control bg-surface-2 px-3 text-[16px] outline-none focus:ring-2 focus:ring-accent";

type Opt = { id: string; name: string };

/** Botón "+ Nota de la noche": varias notas por noche (informativas o tareas), generales o de un empleado. */
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
        className="flex min-h-12 w-full items-center justify-center rounded-card bg-surface px-3 text-[16px] font-semibold text-accent active:opacity-70"
      >
        + Nota de la noche
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Nota de la noche">
        {open && (
          <NoteForm key={n} date={date} employees={employees} departments={departments} onDone={() => setOpen(false)} />
        )}
      </BottomSheet>
    </>
  );
}

function NoteForm({
  date,
  employees,
  departments,
  onDone,
}: {
  date: DateStr;
  employees: Opt[];
  departments: Opt[];
  onDone: () => void;
}) {
  const [kind, setKind] = useState<"INFO" | "TASK">("INFO");
  const [employeeId, setEmployeeId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [text, setText] = useState("");
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
            const r = await addNightNote({
              date,
              employeeId: employeeId || null,
              departmentId: departmentId || null,
              kind,
              text,
            });
            if (r.ok) onDone();
            else setError(r.error);
          })
        }
        className="min-h-11 rounded-control bg-accent text-[16px] font-semibold text-accent-fg disabled:opacity-40"
      >
        {pending ? "Guardando…" : kind === "TASK" ? "Añadir tarea" : "Añadir nota"}
      </button>
    </div>
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
