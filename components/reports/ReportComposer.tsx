"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createReport, discardUploadedFiles } from "@/app/actions/reports";
import { PrimaryButton, inputClass, notify } from "@/components/settings/kit";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { DateStr } from "@/lib/dates";
import { isDateStr } from "@/lib/dates";
import { MAX_REPORT_TEXT } from "@/lib/reports";
import { type UploadedPhoto, uploadPhoto } from "@/lib/upload";
import { MAX_PHOTOS_PER_REPORT } from "@/lib/upload-rules";
import { useStorageMode } from "./StorageContext";

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

interface Item {
  key: string;
  preview: string;
  status: "uploading" | "done" | "error";
  progress: number;
  error?: string;
  file: File;
  result?: UploadedPhoto;
}

let keySeq = 0;

export function ReportComposer({ open, onClose, date, employees, sections, employeeId }: ReportComposerProps) {
  const mode = useStorageMode();
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState("");
  const [emp, setEmp] = useState<string>(employeeId ?? "");
  const [section, setSection] = useState("");
  const [day, setDay] = useState<string>(date);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const removed = useRef(new Set<string>());
  const controllers = useRef(new Map<string, AbortController>());
  const itemsRef = useRef<Item[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  });

  // Reinicia el formulario cada vez que se abre.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setItems([]);
      setText("");
      setEmp(employeeId ?? "");
      setSection("");
      setDay(date);
      setError(null);
    }
  }

  // Libera las URLs de vista previa al desmontar.
  useEffect(
    () => () => {
      itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview));
    },
    [],
  );

  const patch = (key: string, p: Partial<Item>) =>
    setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...p } : i)));

  function startUpload(item: Item) {
    const ctrl = new AbortController();
    controllers.current.set(item.key, ctrl);
    patch(item.key, { status: "uploading", progress: 0, error: undefined });
    uploadPhoto(item.file, {
      mode,
      signal: ctrl.signal,
      onProgress: (f) => patch(item.key, { progress: f }),
    })
      .then((result) => {
        controllers.current.delete(item.key);
        if (removed.current.has(item.key)) {
          void discardUploadedFiles({ pathnames: [result.pathname] });
          return;
        }
        patch(item.key, { status: "done", progress: 1, result });
      })
      .catch((e: unknown) => {
        controllers.current.delete(item.key);
        if (removed.current.has(item.key)) return;
        patch(item.key, { status: "error", error: e instanceof Error ? e.message : "No se pudo subir la foto." });
      });
  }

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_PHOTOS_PER_REPORT - items.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > picked.length) setError(`Máximo ${MAX_PHOTOS_PER_REPORT} fotos por aviso.`);
    else setError(null);
    const news: Item[] = picked.map((file) => ({
      key: `p${++keySeq}`,
      preview: URL.createObjectURL(file),
      status: "uploading",
      progress: 0,
      file,
    }));
    setItems((cur) => [...cur, ...news]);
    news.forEach(startUpload);
  }

  function removeItem(item: Item) {
    removed.current.add(item.key);
    controllers.current.get(item.key)?.abort();
    URL.revokeObjectURL(item.preview);
    setItems((cur) => cur.filter((i) => i.key !== item.key));
    if (item.result) void discardUploadedFiles({ pathnames: [item.result.pathname] });
  }

  function close() {
    // Descarta lo subido que no se llegó a enviar.
    const orphan = itemsRef.current.flatMap((i) => (i.result ? [i.result.pathname] : []));
    itemsRef.current.forEach((i) => {
      removed.current.add(i.key);
      controllers.current.get(i.key)?.abort();
      URL.revokeObjectURL(i.preview);
    });
    if (orphan.length) void discardUploadedFiles({ pathnames: orphan });
    setItems([]);
    onClose();
  }

  const uploading = items.some((i) => i.status === "uploading");
  const failed = items.some((i) => i.status === "error");
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
          photos: items.flatMap((i) => (i.result ? [i.result] : [])),
        });
        if (r.ok) {
          notify("Aviso enviado");
          items.forEach((i) => URL.revokeObjectURL(i.preview));
          setItems([]);
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
        {error && (
          <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-[14px] text-danger">
            {error}
          </p>
        )}

        <section aria-label="Fotos" className="flex flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-label="Elegir fotos"
            data-testid="photo-input"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={items.length >= MAX_PHOTOS_PER_REPORT}
            onClick={() => fileRef.current?.click()}
            className="flex min-h-12 items-center justify-center gap-2 rounded-control bg-surface-2 text-[16px] font-medium text-accent disabled:opacity-40"
          >
            <span aria-hidden>📷</span> Hacer foto / Elegir
            <span className="text-[13px] text-muted">
              ({items.length}/{MAX_PHOTOS_PER_REPORT})
            </span>
          </button>
          {items.length > 0 && (
            <ul className="grid grid-cols-3 gap-2">
              {items.map((it, n) => (
                <li key={it.key} className="relative">
                  <div className="relative aspect-square overflow-hidden rounded-control bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.preview} alt={`Foto ${n + 1}`} className="h-full w-full object-cover" />
                    {it.status === "uploading" && (
                      <div className="absolute inset-x-0 bottom-0 bg-black/50 p-1.5" role="progressbar" aria-valuenow={Math.round(it.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Subiendo foto ${n + 1}`}>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/30">
                          <div className="h-full rounded-full bg-white transition-[width]" style={{ width: `${Math.max(6, Math.round(it.progress * 100))}%` }} />
                        </div>
                      </div>
                    )}
                    {it.status === "error" && (
                      <button
                        type="button"
                        onClick={() => startUpload(it)}
                        className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 p-1 text-center text-[12px] font-medium text-white"
                      >
                        <span>{it.error}</span>
                        <span className="rounded-full bg-white px-2 py-1 text-black">Reintentar</span>
                      </button>
                    )}
                    {it.status === "done" && (
                      <span className="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-success text-[11px] text-white" aria-label="Subida">
                        ✓
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(it)}
                    aria-label={`Quitar foto ${n + 1}`}
                    className="absolute -right-2 -top-2 flex h-11 w-11 items-start justify-end"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-fg text-[13px] text-bg">✕</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

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
