"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { deleteNote, deleteNotePhoto, saveNote } from "@/app/actions/notes";
import { PhotoPicker, usePhotoUploads } from "@/components/reports/PhotoPicker";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Segmented } from "@/components/ui/Segmented";
import { TimeInput } from "@/components/ui/TimeInput";
import { notify } from "@/components/ui/toast";
import { type DateStr, isDateStr } from "@/lib/dates";
import { MAX_NOTE_TEXT, NOTE_TYPES, NOTE_TYPE_META, type NoteType, type NoteView } from "@/lib/notes";
import { MAX_PHOTOS_PER_REPORT } from "@/lib/upload-rules";

type Opt = { id: string; name: string };

/** Listas para elegir persona, departamento y sección. */
export interface NoteOptions {
  employees: Opt[];
  departments: Opt[];
  sections: Opt[];
}

/** Lo que llega ya puesto en una nota nueva (desde Hoy → persona, la ficha, un departamento…). */
export interface NoteDefaults {
  date: DateStr;
  employeeId?: string | null;
  departmentId?: string | null;
  type?: NoteType;
}

const field = "w-full min-h-11 rounded-control bg-surface-2 px-3 text-[16px] outline-none focus:ring-2 focus:ring-accent";
const label = "text-[13px] font-medium text-muted";

/**
 * LA hoja de nota: la misma desde Hoy (⋯ o la ficha de una persona), Informe y la ficha del empleado.
 * Con `note` se edita (y se puede borrar); sin ella, nota nueva con `defaults`.
 */
export function NoteSheet({
  open,
  onClose,
  note,
  defaults,
  options,
}: {
  open: boolean;
  onClose: () => void;
  note?: NoteView | null;
  defaults: NoteDefaults;
  options: NoteOptions;
}) {
  // Cada apertura empieza de cero (y descarta las fotos que no se guardaron).
  const [n, setN] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setN((x) => x + 1);
  }
  const title = note ? `Editar ${NOTE_TYPE_META[note.type].label.toLowerCase()}` : "Nueva nota";
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {open && <NoteForm key={`${note?.id ?? "new"}-${n}`} note={note ?? null} defaults={defaults} options={options} onDone={onClose} />}
    </BottomSheet>
  );
}

/** Si la persona/departamento de la nota ya no está en la lista (inactivo), se añade para no perderlo al guardar. */
function withCurrent(list: Opt[], id: string | null | undefined, name: string | null | undefined): Opt[] {
  return id && !list.some((o) => o.id === id) ? [{ id, name: name ?? "(ya no está)" }, ...list] : list;
}

function NoteForm({ note, defaults, options, onDone }: { note: NoteView | null; defaults: NoteDefaults; options: NoteOptions; onDone: () => void }) {
  const existing = note?.photos ?? [];
  const uploads = usePhotoUploads(Math.max(0, MAX_PHOTOS_PER_REPORT - existing.length));
  const [type, setType] = useState<NoteType>(note?.type ?? defaults.type ?? "NOTE");
  const [text, setText] = useState(note?.text ?? "");
  const [employeeId, setEmployeeId] = useState(note ? (note.employeeId ?? "") : (defaults.employeeId ?? ""));
  const [departmentId, setDepartmentId] = useState(note ? (note.departmentId ?? "") : (defaults.departmentId ?? ""));
  const [sectionId, setSectionId] = useState(note?.sectionId ?? "");
  const [date, setDate] = useState<string>(note?.date ?? defaults.date);
  const [time, setTime] = useState(note?.time ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  // Lo menos usado, plegado (se abre solo si la nota ya lo tiene).
  const [more, setMore] = useState(!!(note && (note.departmentId || note.sectionId || note.time || note.date !== defaults.date)));

  const employees = withCurrent(options.employees, note?.employeeId, note?.employeeName);
  const departments = withCurrent(options.departments, note?.departmentId, note?.departmentName);
  const sections = withCurrent(options.sections, note?.sectionId, note?.sectionName);

  // Al cerrar sin guardar, fuera las fotos subidas.
  const sent = useRef(false);
  const latest = useRef(uploads);
  useEffect(() => {
    latest.current = uploads;
  });
  useEffect(
    () => () => {
      if (!sent.current) latest.current.discard();
    },
    [],
  );

  const canSave = !pending && !uploads.uploading && !uploads.failed && text.trim().length > 0 && isDateStr(date);
  const hint = uploads.uploading ? "Subiendo fotos…" : uploads.failed ? "Reintenta o quita las fotos que han fallado." : null;

  function save() {
    setError(null);
    start(async () => {
      try {
        const r = await saveNote({
          id: note?.id,
          date,
          time: time || null,
          type,
          text,
          employeeId: employeeId || null,
          departmentId: departmentId || null,
          sectionId: sectionId || null,
          photos: uploads.results,
        });
        if (r.ok) {
          sent.current = true;
          uploads.clearSent();
          notify(note ? "Nota guardada" : type === "TASK" ? "Tarea añadida" : "Nota añadida");
          onDone();
        } else setError(r.error);
      } catch {
        setError("No se pudo guardar. Comprueba la conexión e inténtalo de nuevo.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 pb-2">
      {(error ?? uploads.error) && (
        <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-[14px] text-danger">
          {error ?? uploads.error}
        </p>
      )}

      <Segmented
        wrap
        aria-label="Tipo de nota"
        value={type}
        onChange={setType}
        options={NOTE_TYPES.map((t) => ({ value: t, label: NOTE_TYPE_META[t].label, color: NOTE_TYPE_META[t].color }))}
      />

      <textarea
        aria-label="Nota"
        value={text}
        maxLength={MAX_NOTE_TEXT}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          type === "TASK"
            ? "Ej.: apuntar sus horas extra en el Excel…"
            : type === "REQUEST"
              ? "Ej.: pide librar el sábado 18 en vez del lunes…"
              : employeeId
                ? "¿Qué ha pasado? ¿Qué se habló?"
                : "Ej.: palé roto en el pasillo de cerveza…"
        }
        className={`${field} min-h-[110px] py-2`}
      />

      <label className="flex flex-col gap-1.5">
        <span className={label}>Persona</span>
        <select aria-label="Persona" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={field}>
          <option value="">General (nadie en concreto)</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>

      {existing.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Fotos guardadas">
          {existing.map((p, i) => (
            <li key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`Foto ${i + 1}`} className="h-[72px] w-[72px] rounded-control object-cover" />
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await deleteNotePhoto(p.id);
                    if (r.ok) notify("Foto quitada");
                    else setError(r.error);
                  })
                }
                aria-label={`Quitar foto guardada ${i + 1}`}
                className="absolute -right-2 -top-2 flex h-11 w-11 items-start justify-end"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-fg text-[13px] text-bg">✕</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <PhotoPicker uploads={uploads} noun="nota" />

      {more ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={label}>Departamento</span>
              <select aria-label="Departamento" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={field}>
                <option value="">—</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            {sections.length > 0 && (
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className={label}>Sección</span>
                <select aria-label="Sección" value={sectionId} onChange={(e) => setSectionId(e.target.value)} className={field}>
                  <option value="">—</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={label}>Noche</span>
              <input type="date" aria-label="Noche" value={date} onChange={(e) => setDate(e.target.value)} className={`${field} min-w-0`} />
            </label>
            <TimeInput label="Hora" clearable value={time} onChange={setTime} />
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setMore(true)} className="min-h-11 self-start text-[15px] font-medium text-accent">
          + Departamento, sección, noche u hora
        </button>
      )}

      <button
        type="button"
        disabled={!canSave}
        onClick={save}
        className="press min-h-12 rounded-control bg-accent text-[16px] font-semibold text-accent-fg disabled:opacity-40"
      >
        {pending ? "Guardando…" : note ? "Guardar cambios" : type === "TASK" ? "Añadir tarea" : "Añadir nota"}
      </button>
      {hint && (
        <p className="text-center text-[13px] text-muted" aria-live="polite">
          {hint}
        </p>
      )}

      {note &&
        (confirmDelete ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await deleteNote(note.id);
                if (r.ok) {
                  sent.current = true;
                  notify("Nota borrada");
                  onDone();
                } else setError(r.error);
              })
            }
            className="min-h-11 rounded-control bg-danger text-[15px] font-semibold text-white"
          >
            Sí, borrar {note.photos.length > 0 ? "nota y fotos" : "nota"}
          </button>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="min-h-11 text-[15px] font-medium text-danger">
            Borrar nota
          </button>
        ))}
    </div>
  );
}
