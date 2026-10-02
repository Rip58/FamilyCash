"use client";

import { useState } from "react";
import { PhotoViewer } from "@/components/reports/PhotoViewer";
import type { ProtocolStepView } from "@/lib/planogram-format";
import { Highlight } from "./ProtocolBody";

/** Manual paso a paso: número, foto grande (toca para ampliar) y explicación. */
export function ProtocolSteps({ steps, title, query }: { steps: ProtocolStepView[]; title: string; query?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (steps.length === 0) return null;
  const withPhoto = steps.flatMap((s, i) => (s.photo ? [{ step: i, photo: s.photo, id: s.id }] : []));
  const photos = withPhoto.map((p) => ({ id: p.id, url: p.photo.url, width: p.photo.width, height: p.photo.height, size: p.photo.size }));
  const viewerIndex = open === null ? null : withPhoto.findIndex((p) => p.step === open);
  const caption = open === null ? undefined : `${title} · Paso ${open + 1}${steps[open]?.text ? `: ${steps[open]!.text}` : ""}`;

  return (
    <>
      <ol className="mt-3 flex flex-col gap-4" aria-label="Pasos">
        {steps.map((s, i) => (
          <li key={s.id} className="flex flex-col gap-2">
            <div className="flex items-start gap-2.5">
              <span
                aria-hidden
                className="flex h-7 min-w-7 items-center justify-center rounded-full bg-accent px-1.5 text-[14px] font-bold text-white"
              >
                {i + 1}
              </span>
              <p className="flex-1 whitespace-pre-wrap pt-0.5 text-[16px] leading-snug">
                <span className="sr-only">Paso {i + 1}: </span>
                {s.text ? <Highlight text={s.text} query={query} /> : <span className="text-muted">Paso {i + 1}</span>}
              </p>
            </div>
            {s.photo && (
              <button
                type="button"
                onClick={() => setOpen(i)}
                aria-label={`Ampliar foto del paso ${i + 1}`}
                className="block overflow-hidden rounded-control bg-surface-2 active:opacity-80"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.photo.url}
                  alt=""
                  loading="lazy"
                  width={s.photo.width}
                  height={s.photo.height}
                  className="h-auto w-full"
                />
              </button>
            )}
          </li>
        ))}
      </ol>
      <PhotoViewer
        photos={photos}
        index={viewerIndex !== null && viewerIndex >= 0 ? viewerIndex : null}
        caption={caption}
        onClose={() => setOpen(null)}
      />
    </>
  );
}
