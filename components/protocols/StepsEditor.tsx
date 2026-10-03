"use client";

import { useEffect, useRef } from "react";
import { useStorageMode } from "@/components/reports/StorageContext";
import { cn } from "@/components/ui/cn";
import { MAX_STEP_TEXT, MAX_STEPS, type StepPhoto } from "@/lib/planogram-format";
import { uploadPhoto } from "@/lib/upload";

export interface EditorStep {
  key: string;
  text: string;
  photo: StepPhoto | null;
  /** Progreso de subida (0–1) mientras se sube una foto. */
  uploading: number | null;
  error: string | null;
}

let seq = 0;
export const newStepKey = () => `s${++seq}`;

type SetSteps = (fn: (cur: EditorStep[]) => EditorStep[]) => void;

/**
 * Pasos del manual (Paso 1, Paso 2…): cada uno con foto opcional (se comprime a WebP) y explicación.
 * `onUploaded` avisa de cada foto subida, para poder descartarla si no se llega a guardar.
 */
export function StepsEditor({
  steps,
  setSteps,
  onUploaded,
  onRemovedPhoto,
}: {
  steps: EditorStep[];
  setSteps: SetSteps;
  onUploaded: (pathname: string) => void;
  onRemovedPhoto: (pathname: string) => void;
}) {
  const mode = useStorageMode();
  const current = useRef(steps);
  useEffect(() => {
    current.current = steps;
  });
  const patch = (key: string, p: Partial<EditorStep>) => setSteps((cur) => cur.map((s) => (s.key === key ? { ...s, ...p } : s)));

  function upload(key: string, file: File) {
    patch(key, { uploading: 0, error: null });
    uploadPhoto(file, { mode, onProgress: (f) => patch(key, { uploading: f }) })
      .then((r) => {
        onUploaded(r.pathname);
        const old = current.current.find((st) => st.key === key);
        if (!old) {
          onRemovedPhoto(r.pathname); // se borró el paso mientras subía
          return;
        }
        if (old.photo) onRemovedPhoto(old.photo.pathname);
        const photo: StepPhoto = { url: r.url, pathname: r.pathname, width: r.width, height: r.height, size: r.size };
        patch(key, { photo, uploading: null });
      })
      .catch((e: unknown) =>
        patch(key, { uploading: null, error: e instanceof Error ? e.message : "No se pudo subir la foto." }),
      );
  }

  function move(i: number, d: -1 | 1) {
    setSteps((cur) => {
      const j = i + d;
      if (j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  function remove(key: string) {
    const st = steps.find((x) => x.key === key);
    if (st?.photo) onRemovedPhoto(st.photo.pathname);
    setSteps((cur) => cur.filter((x) => x.key !== key));
  }

  const add = () =>
    setSteps((cur) => [...cur, { key: newStepKey(), text: "", photo: null, uploading: null, error: null }]);

  return (
    <section aria-label="Pasos con foto" className="mt-6">
      <div className="mb-1 px-1">
        <h2 className="text-[13px] font-medium text-muted">Pasos con foto (opcional)</h2>
        <p className="text-[13px] text-muted">Para manuales: una foto y qué hacer en cada paso.</p>
      </div>
      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <StepCard
            key={s.key}
            step={s}
            index={i}
            total={steps.length}
            onText={(text) => patch(s.key, { text })}
            onFile={(f) => upload(s.key, f)}
            onRemovePhoto={() => {
              if (s.photo) onRemovedPhoto(s.photo.pathname);
              patch(s.key, { photo: null });
            }}
            onMove={(d) => move(i, d)}
            onRemove={() => remove(s.key)}
          />
        ))}
      </ol>
      <button
        type="button"
        onClick={add}
        disabled={steps.length >= MAX_STEPS}
        className="mt-3 min-h-12 w-full rounded-card bg-surface text-[16px] font-semibold text-accent disabled:opacity-40"
      >
        + Añadir paso {steps.length + 1}
      </button>
    </section>
  );
}

function StepCard({
  step,
  index,
  total,
  onText,
  onFile,
  onRemovePhoto,
  onMove,
  onRemove,
}: {
  step: EditorStep;
  index: number;
  total: number;
  onText: (t: string) => void;
  onFile: (f: File) => void;
  onRemovePhoto: () => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const n = index + 1;
  const iconBtn =
    "flex min-h-11 min-w-11 items-center justify-center rounded-control text-[18px] text-accent active:bg-surface-2 disabled:opacity-30";
  return (
    <li className="rounded-card bg-surface p-3" aria-label={`Paso ${n}`}>
      <div className="flex items-center gap-1">
        <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-accent px-1.5 text-[14px] font-bold text-white">
          {n}
        </span>
        <span className="ml-1 flex-1 text-[16px] font-semibold">Paso {n}</span>
        <button type="button" aria-label={`Subir paso ${n}`} disabled={index === 0} onClick={() => onMove(-1)} className={iconBtn}>
          ↑
        </button>
        <button type="button" aria-label={`Bajar paso ${n}`} disabled={index === total - 1} onClick={() => onMove(1)} className={iconBtn}>
          ↓
        </button>
        <button type="button" aria-label={`Borrar paso ${n}`} onClick={onRemove} className={cn(iconBtn, "text-danger")}>
          🗑
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-label={`Foto del paso ${n}`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      {step.photo ? (
        <div className="mt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={step.photo.url} alt={`Foto del paso ${n}`} className="h-auto w-full rounded-control bg-surface-2" />
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              disabled={step.uploading !== null}
              onClick={() => fileRef.current?.click()}
              className="min-h-11 flex-1 rounded-full bg-surface-2 text-[14px] font-medium text-accent"
            >
              Cambiar foto
            </button>
            <button
              type="button"
              onClick={onRemovePhoto}
              className="min-h-11 flex-1 rounded-full bg-surface-2 text-[14px] font-medium text-danger"
            >
              Quitar foto
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={step.uploading !== null}
          onClick={() => fileRef.current?.click()}
          className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-surface-2 text-[16px] font-medium text-accent disabled:opacity-60"
        >
          <span aria-hidden>📷</span> Hacer foto / Elegir
        </button>
      )}
      {step.uploading !== null && (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label={`Subiendo foto del paso ${n}`}
          aria-valuenow={Math.round(step.uploading * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.max(6, step.uploading * 100)}%` }} />
        </div>
      )}
      {step.error && (
        <p role="alert" className="mt-1 text-[14px] text-danger">
          {step.error}
        </p>
      )}

      <textarea
        aria-label={`Qué hacer en el paso ${n}`}
        value={step.text}
        maxLength={MAX_STEP_TEXT}
        rows={3}
        onChange={(e) => onText(e.target.value)}
        placeholder={index === 0 ? "Ej.: Pulsa PARO y espera a que la prensa se detenga." : "¿Qué hay que hacer?"}
        className="mt-2 w-full rounded-control bg-surface-2 p-3 text-[16px] leading-snug outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
      />
    </li>
  );
}
