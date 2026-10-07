"use client";

import { useEffect, useRef, useState } from "react";
import { discardUploadedFiles } from "@/app/actions/reports";
import { type UploadedPhoto, uploadPhoto } from "@/lib/upload";
import { MAX_PHOTOS_PER_REPORT } from "@/lib/upload-rules";
import { useStorageMode } from "./StorageContext";

export interface PhotoItem {
  key: string;
  preview: string;
  status: "uploading" | "done" | "error";
  progress: number;
  error?: string;
  file: File;
  result?: UploadedPhoto;
}

let keySeq = 0;

/**
 * Estado de las fotos que se están eligiendo/subiendo (compresión + subida
 * directa, reintento, descarte de lo subido y no enviado). Lo usan las notas,
 * los lineales y los pasos de protocolo.
 */
export function usePhotoUploads(max: number = MAX_PHOTOS_PER_REPORT) {
  const mode = useStorageMode();
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const removed = useRef(new Set<string>());
  const controllers = useRef(new Map<string, AbortController>());
  const itemsRef = useRef<PhotoItem[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  });

  // Libera las URLs de vista previa al desmontar.
  useEffect(
    () => () => {
      itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview));
    },
    [],
  );

  const patch = (key: string, p: Partial<PhotoItem>) =>
    setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...p } : i)));

  function start(item: PhotoItem) {
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

  function add(files: FileList | null, noun = "nota") {
    if (!files || files.length === 0) return;
    const room = max - items.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > picked.length) setError(`Máximo ${max} fotos por ${noun}.`);
    else setError(null);
    const news: PhotoItem[] = picked.map((file) => ({
      key: `p${++keySeq}`,
      preview: URL.createObjectURL(file),
      status: "uploading",
      progress: 0,
      file,
    }));
    setItems((cur) => [...cur, ...news]);
    news.forEach(start);
  }

  function remove(item: PhotoItem) {
    removed.current.add(item.key);
    controllers.current.get(item.key)?.abort();
    URL.revokeObjectURL(item.preview);
    setItems((cur) => cur.filter((i) => i.key !== item.key));
    if (item.result) void discardUploadedFiles({ pathnames: [item.result.pathname] });
  }

  /** Vacía la lista tras un envío correcto (las fotos ya pertenecen al registro). */
  function clearSent() {
    itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview));
    setItems([]);
    setError(null);
  }

  /** Descarta lo subido que no se llegó a enviar y vacía la lista. */
  function discard() {
    const orphan = itemsRef.current.flatMap((i) => (i.result ? [i.result.pathname] : []));
    itemsRef.current.forEach((i) => {
      removed.current.add(i.key);
      controllers.current.get(i.key)?.abort();
      URL.revokeObjectURL(i.preview);
    });
    if (orphan.length) void discardUploadedFiles({ pathnames: orphan });
    setItems([]);
    setError(null);
  }

  return {
    items,
    error,
    setError,
    add,
    remove,
    retry: start,
    clearSent,
    discard,
    max,
    uploading: items.some((i) => i.status === "uploading"),
    failed: items.some((i) => i.status === "error"),
    results: items.flatMap((i) => (i.result ? [i.result] : [])),
  };
}

export type PhotoUploads = ReturnType<typeof usePhotoUploads>;

/** Botón "Hacer foto / Elegir" + cuadrícula de miniaturas con progreso. */
export function PhotoPicker({ uploads, noun = "nota" }: { uploads: PhotoUploads; noun?: string }) {
  const { items, max } = uploads;
  const fileRef = useRef<HTMLInputElement>(null);
  return (
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
          uploads.add(e.target.files, noun);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={items.length >= max}
        onClick={() => fileRef.current?.click()}
        className="flex min-h-12 items-center justify-center gap-2 rounded-control bg-surface-2 text-[16px] font-medium text-accent disabled:opacity-40"
      >
        <span aria-hidden>📷</span> Hacer foto / Elegir
        <span className="text-[13px] text-muted">
          ({items.length}/{max})
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
                  <div
                    className="absolute inset-x-0 bottom-0 bg-black/50 p-1.5"
                    role="progressbar"
                    aria-valuenow={Math.round(it.progress * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Subiendo foto ${n + 1}`}
                  >
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/30">
                      <div
                        className="h-full rounded-full bg-white transition-[width]"
                        style={{ width: `${Math.max(6, Math.round(it.progress * 100))}%` }}
                      />
                    </div>
                  </div>
                )}
                {it.status === "error" && (
                  <button
                    type="button"
                    onClick={() => uploads.retry(it)}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 p-1 text-center text-[12px] font-medium text-white"
                  >
                    <span>{it.error}</span>
                    <span className="rounded-full bg-white px-2 py-1 text-black">Reintentar</span>
                  </button>
                )}
                {it.status === "done" && (
                  <span
                    className="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-success text-[11px] text-white"
                    aria-label="Subida"
                  >
                    ✓
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => uploads.remove(it)}
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
  );
}
