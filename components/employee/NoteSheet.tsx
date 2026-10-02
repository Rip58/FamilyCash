"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createNote, deleteNote, deleteNotePhoto, updateNote } from "@/app/actions/employee-file";
import { PhotoPicker, usePhotoUploads } from "@/components/reports/PhotoPicker";
import { ConfirmButton, PrimaryButton, inputClass, notify } from "@/components/settings/kit";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Segmented } from "@/components/ui/Segmented";
import { TimeInput } from "@/components/ui/TimeInput";
import { isDateStr, madridParts, madridTime } from "@/lib/dates";
import { CATEGORY_META, MAX_NOTE_TEXT, NOTE_CATEGORIES, type NoteCategory, type NoteView } from "@/lib/employee-file";
import { photoCountLabel } from "@/lib/report-format";
import { MAX_PHOTOS_PER_REPORT } from "@/lib/upload-rules";

interface NoteSheetProps {
  open: boolean;
  onClose: () => void;
  employeeId: string;
  /** Nota a editar; null = nota nueva. */
  note: NoteView | null;
}

/** Hoja para crear o editar una nota de ficha. */
export function NoteSheet({ open, onClose, employeeId, note }: NoteSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={note ? "Editar nota" : "Nueva nota"}>
      {open && <NoteForm key={note?.id ?? "new"} employeeId={employeeId} note={note} onClose={onClose} />}
    </BottomSheet>
  );
}

function NoteForm({ employeeId, note, onClose }: { employeeId: string; note: NoteView | null; onClose: () => void }) {
  const initial = note ? madridParts(new Date(note.occurredAt)) : madridParts(new Date());
  const existing = note?.photos.length ?? 0;
  const uploads = usePhotoUploads(Math.max(0, MAX_PHOTOS_PER_REPORT - existing));
  const [category, setCategory] = useState<NoteCategory>(note?.category ?? "NOTE");
  const [date, setDate] = useState<string>(initial.date);
  const [time, setTime] = useState(note ? madridTime(new Date(note.occurredAt)) : madridTime(new Date()));
  const [text, setText] = useState(note?.text ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Al cerrar sin guardar, descarta las fotos ya subidas.
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

  const validDate = isDateStr(date);
  const canSave = !uploads.uploading && !uploads.failed && text.trim().length > 0 && validDate && time !== "" && !pending;
  const hint = uploads.uploading
    ? "Subiendo fotos…"
    : uploads.failed
      ? "Reintenta o quita las fotos que han fallado."
      : !text.trim()
        ? "Escribe el texto de la nota."
        : null;

  function save() {
    setError(null);
    start(async () => {
      try {
        const base = { date, time, category, text, photos: uploads.results };
        const r = note ? await updateNote({ id: note.id, ...base }) : await createNote({ employeeId, ...base });
        if (r.ok) {
          sent.current = true;
          notify(note ? "Nota actualizada" : "Nota guardada");
          onClose();
        } else setError(r.error);
      } catch {
        setError("No se pudo guardar. Comprueba la conexión e inténtalo de nuevo.");
      }
    });
  }

  function removeExisting(photoId: string) {
    start(async () => {
      const r = await deleteNotePhoto({ photoId });
      if (r.ok) notify("Foto quitada");
      else setError(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-4 pb-2">
      {(error ?? uploads.error) && (
        <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-[14px] text-danger">
          {error ?? uploads.error}
        </p>
      )}

      <Segmented
        wrap
        aria-label="Categoría"
        value={category}
        onChange={setCategory}
        options={NOTE_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_META[c].label, color: CATEGORY_META[c].color }))}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[13px] text-muted">Fecha</span>
          <input
            type="date"
            aria-label="Fecha"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${inputClass} min-w-0`}
          />
        </label>
        <TimeInput label="Hora" value={time} onChange={setTime} />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] text-muted">Texto (obligatorio)</span>
        <textarea
          aria-label="Texto de la nota"
          value={text}
          rows={4}
          maxLength={MAX_NOTE_TEXT}
          placeholder="¿Qué ha pasado? ¿Qué se habló?"
          onChange={(e) => setText(e.target.value)}
          className={`${inputClass} py-2`}
        />
      </label>

      {note && note.photos.length > 0 && (
        <div>
          <div className="mb-1.5 text-[13px] text-muted">{photoCountLabel(note.photos.length)} guardadas</div>
          <ul className="flex flex-wrap gap-2">
            {note.photos.map((p, i) => (
              <li key={p.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`Foto ${i + 1}`} className="h-[72px] w-[72px] rounded-control object-cover" />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => removeExisting(p.id)}
                  aria-label={`Quitar foto guardada ${i + 1}`}
                  className="absolute -right-2 -top-2 flex h-11 w-11 items-start justify-end"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-fg text-[13px] text-bg">✕</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <PhotoPicker uploads={uploads} noun="nota" />

      <div className="flex flex-col gap-1.5">
        <PrimaryButton onClick={save} disabled={!canSave}>
          {pending ? "Guardando…" : note ? "Guardar cambios" : "Guardar nota"}
        </PrimaryButton>
        {hint && (
          <p className="text-center text-[13px] text-muted" aria-live="polite">
            {hint}
          </p>
        )}
      </div>

      {note && (
        <ConfirmButton
          label="Borrar nota"
          confirmLabel="Sí, borrar nota y fotos"
          disabled={pending}
          onConfirm={() =>
            start(async () => {
              const r = await deleteNote({ id: note.id });
              if (r.ok) {
                sent.current = true;
                notify("Nota borrada");
                onClose();
              } else setError(r.error);
            })
          }
        />
      )}
    </div>
  );
}
