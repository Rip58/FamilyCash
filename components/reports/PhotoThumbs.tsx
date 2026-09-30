"use client";

import type { ReportPhotoView } from "@/lib/reports";

/** Miniaturas de fotos (72px) que abren el visor al tocarlas. */
export function PhotoThumbs({
  photos,
  onOpen,
  label = "Fotos del aviso",
}: {
  photos: ReportPhotoView[];
  onOpen: (index: number) => void;
  label?: string;
}) {
  if (photos.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2" aria-label={label}>
      {photos.map((p, i) => (
        <li key={p.id}>
          <button
            type="button"
            onClick={() => onOpen(i)}
            aria-label={`Abrir foto ${i + 1} de ${photos.length}`}
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
