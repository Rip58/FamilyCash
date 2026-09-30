"use client";

import { useState, useTransition } from "react";
import { deleteReport, deleteReportPhoto, updateReport } from "@/app/actions/reports";
import { ConfirmButton, PrimaryButton, inputClass, notify } from "@/components/settings/kit";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { formatDayLong } from "@/lib/dates";
import { MAX_REPORT_TEXT, photoCountLabel, type ReportView } from "@/lib/reports";
import { PhotoViewer } from "./PhotoViewer";

interface ReportCardProps {
  report: ReportView;
  /** Muestra la fecha de la noche (listado). */
  showDate?: boolean;
  /** Oculta el botón de editar/borrar. */
  readOnly?: boolean;
}

function Thumbs({ report, onOpen }: { report: ReportView; onOpen: (i: number) => void }) {
  if (report.photos.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2" aria-label="Fotos del aviso">
      {report.photos.map((p, i) => (
        <li key={p.id}>
          <button
            type="button"
            onClick={() => onOpen(i)}
            aria-label={`Abrir foto ${i + 1} de ${report.photos.length}`}
            className="block h-[72px] w-[72px] overflow-hidden rounded-control bg-surface-2 active:opacity-70"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ReportCard({ report, showDate, readOnly }: ReportCardProps) {
  const [viewer, setViewer] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);

  const caption = `${report.employeeName ? `${report.employeeName}: ` : ""}${report.text}`;
  return (
    <article className="rounded-card bg-surface px-4 py-3" aria-label="Aviso">
      <header className="flex flex-wrap items-baseline gap-x-2 text-[13px] text-muted">
        <span className="font-semibold text-fg">{report.employeeName ?? "Aviso"}</span>
        {report.sectionName && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[12px]">{report.sectionName}</span>}
        <span className="ml-auto tabular-nums">
          {showDate ? `${formatDayLong(report.date)} · ` : ""}
          {report.createdTime}
        </span>
      </header>
      <p className="mt-1 whitespace-pre-wrap break-words text-[15px]">{report.text}</p>
      <Thumbs report={report} onOpen={setViewer} />
      {!readOnly && (
        <div className="mt-1 flex justify-end">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-11 rounded-full px-3 text-[14px] font-medium text-accent"
          >
            Editar
          </button>
        </div>
      )}
      <PhotoViewer photos={report.photos} index={viewer} caption={caption} onClose={() => setViewer(null)} />
      {editing && <EditSheet report={report} onClose={() => setEditing(false)} />}
    </article>
  );
}

function EditSheet({ report, onClose }: { report: ReportView; onClose: () => void }) {
  const [text, setText] = useState(report.text);
  const [open, setOpen] = useState(true);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setOpen(false);
    setTimeout(onClose, 220);
  };
  const dirty = text.trim() !== report.text;

  const save = () =>
    start(async () => {
      const r = await updateReport({ id: report.id, text, employeeId: report.employeeId, sectionId: report.sectionId });
      if (r.ok) {
        notify("Aviso actualizado");
        close();
      } else setError(r.error);
    });

  const remove = () =>
    start(async () => {
      const r = await deleteReport({ id: report.id });
      if (r.ok) {
        notify("Aviso borrado");
        close();
      } else setError(r.error);
    });

  const removePhoto = (photoId: string) =>
    start(async () => {
      const r = await deleteReportPhoto({ photoId });
      if (r.ok) notify("Foto quitada");
      else setError(r.error);
    });

  return (
    <BottomSheet open={open} onClose={close} title="Editar aviso">
      <div className="flex flex-col gap-3 pb-2">
        {error && (
          <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-[14px] text-danger">
            {error}
          </p>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-muted">Nota</span>
          <textarea
            value={text}
            rows={4}
            maxLength={MAX_REPORT_TEXT}
            onChange={(e) => setText(e.target.value)}
            className={`${inputClass} py-2`}
          />
        </label>
        {report.photos.length > 0 && (
          <div>
            <div className="mb-1.5 text-[13px] text-muted">{photoCountLabel(report.photos.length)}</div>
            <ul className="flex flex-wrap gap-2">
              {report.photos.map((p, i) => (
                <li key={p.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={`Foto ${i + 1}`} className="h-[72px] w-[72px] rounded-control object-cover" />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => removePhoto(p.id)}
                    aria-label={`Quitar foto ${i + 1}`}
                    className="absolute -right-2 -top-2 flex h-11 w-11 items-start justify-end"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-fg text-[13px] text-bg">✕</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <PrimaryButton onClick={save} disabled={pending || !dirty || !text.trim()}>
          {pending ? "Guardando…" : "Guardar"}
        </PrimaryButton>
        <ConfirmButton label="Borrar aviso" confirmLabel="Sí, borrar aviso" onConfirm={remove} disabled={pending} />
      </div>
    </BottomSheet>
  );
}
