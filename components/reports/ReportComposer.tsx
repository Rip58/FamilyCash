"use client";

import { useState, useTransition } from "react";
import { createReport } from "@/app/actions/reports";
import { PrimaryButton, inputClass, notify } from "@/components/settings/kit";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { DateStr } from "@/lib/dates";
import { isDateStr } from "@/lib/dates";
import { MAX_REPORT_TEXT } from "@/lib/reports";
import { PhotoPicker, usePhotoUploads } from "./PhotoPicker";

export interface ComposerEmployee {
  id: string;
  name: string;
}
export interface ComposerSection {
  id: string;
  name: string;
}

interface ReportComposerProps {
  open: boolean;
  onClose: () => void;
  /** Noche a la que pertenece el aviso (editable). */
  date: DateStr;
  employees: ComposerEmployee[];
  sections: ComposerSection[];
  /** Empleado preseleccionado. */
  employeeId?: string | null;
}

export function ReportComposer({ open, onClose, date, employees, sections, employeeId }: ReportComposerProps) {
  const uploads = usePhotoUploads();
  const [text, setText] = useState("");
  const [emp, setEmp] = useState<string>(employeeId ?? "");
  const [section, setSection] = useState("");
  const [day, setDay] = useState<string>(date);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Reinicia el formulario cada vez que se abre.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setText("");
      setEmp(employeeId ?? "");
      setSection("");
      setDay(date);
      setError(null);
    }
  }

  function close() {
    uploads.discard(); // descarta lo subido que no se llegó a enviar
    onClose();
  }

  const { uploading, failed } = uploads;
  const validDay = isDateStr(day);
  const canSend = !uploading && !failed && text.trim().length > 0 && validDay && !pending;

  function send() {
    setError(null);
    start(async () => {
      try {
        const r = await createReport({
          date: day,
          text,
          employeeId: emp || null,
          sectionId: section || null,
          photos: uploads.results,
        });
        if (r.ok) {
          notify("Aviso enviado");
          uploads.clearSent();
          onClose();
        } else setError(r.error);
      } catch {
        setError("No se pudo enviar. Comprueba la conexión e inténtalo de nuevo.");
      }
    });
  }

  const hint = uploading
    ? "Subiendo fotos…"
    : failed
      ? "Reintenta o quita las fotos que han fallado."
      : !text.trim()
        ? "Escribe una nota para poder enviar."
        : null;

  return (
    <BottomSheet open={open} onClose={close} title="Nuevo aviso">
      <div className="flex flex-col gap-4 pb-2">
        {(error ?? uploads.error) && (
          <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-[14px] text-danger">
            {error ?? uploads.error}
          </p>
        )}

        <PhotoPicker uploads={uploads} />

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-muted">Nota (obligatoria)</span>
          <textarea
            value={text}
            rows={4}
            maxLength={MAX_REPORT_TEXT}
            placeholder="¿Qué ha pasado? Ej. palé mal colocado en pasillo cerveza…"
            onChange={(e) => setText(e.target.value)}
            className={`${inputClass} py-2`}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-muted">Empleado (opcional)</span>
            <select value={emp} onChange={(e) => setEmp(e.target.value)} className={inputClass}>
              <option value="">Ninguno</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-muted">Sección (opcional)</span>
            <select value={section} onChange={(e) => setSection(e.target.value)} className={inputClass}>
              <option value="">Ninguna</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-muted">Noche</span>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={inputClass} />
        </label>

        <div className="flex flex-col gap-1.5">
          <PrimaryButton onClick={send} disabled={!canSend}>
            {pending ? "Enviando…" : "Enviar aviso"}
          </PrimaryButton>
          {hint && (
            <p className="text-center text-[13px] text-muted" aria-live="polite">
              {hint}
            </p>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
