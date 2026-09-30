"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { notify } from "@/components/settings/kit";
import type { ReportPhotoView } from "@/lib/reports";

interface PhotoViewerProps {
  photos: ReportPhotoView[];
  /** Índice inicial; null = cerrado. */
  index: number | null;
  caption?: string;
  onClose: () => void;
}

/** Visor a pantalla completa: swipe entre fotos, cerrar y compartir. */
export function PhotoViewer({ photos, index, caption, onClose }: PhotoViewerProps) {
  if (index === null || photos.length === 0) return null;
  return <Viewer photos={photos} start={index} caption={caption} onClose={onClose} />;
}

function Viewer({ photos, start, caption, onClose }: { photos: ReportPhotoView[]; start: number; caption?: string; onClose: () => void }) {
  const [i, setI] = useState(Math.min(start, photos.length - 1));
  const [dx, setDx] = useState(0);
  const [busy, setBusy] = useState(false);
  const touch = useRef<{ x: number; y: number; locked: boolean } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const photo = photos[i]!;

  const go = (n: number) => setI((cur) => Math.max(0, Math.min(photos.length - 1, cur + n)));

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation(); // no cerrar también la hoja que hay debajo
        onClose();
      } else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]!;
    touch.current = { x: t.clientX, y: t.clientY, locked: false };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const s = touch.current;
    if (!s) return;
    const t = e.touches[0]!;
    const mx = t.clientX - s.x;
    const my = t.clientY - s.y;
    if (!s.locked && Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) s.locked = true;
    if (s.locked) setDx(mx);
  };
  const onTouchEnd = () => {
    const s = touch.current;
    touch.current = null;
    if (s?.locked) {
      if (dx < -50) go(1);
      else if (dx > 50) go(-1);
    }
    setDx(0);
  };

  async function share() {
    setBusy(true);
    try {
      const res = await fetch(photo.url);
      const blob = await res.blob();
      const file = new File([blob], `aviso-${i + 1}.jpg`, { type: blob.type || "image/jpeg" });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: caption });
        } catch (e) {
          if (!(e instanceof DOMException && e.name === "AbortError")) notify("No se pudo compartir.", "error");
        }
      } else {
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(href), 10_000);
        notify("Foto descargada");
      }
    } catch {
      notify("No se pudo obtener la foto.", "error");
    } finally {
      setBusy(false);
    }
  }

  const btn = "flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/15 px-4 text-[15px] font-medium text-white backdrop-blur active:bg-white/25 disabled:opacity-50";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visor de fotos"
      className="fixed inset-0 z-[70] flex select-none flex-col bg-black"
    >
      <div className="flex items-center justify-between px-3 pb-2 pt-[calc(env(safe-area-inset-top)+8px)]">
        <button ref={closeRef} type="button" onClick={onClose} className={btn}>
          Cerrar
        </button>
        <span className="text-[15px] font-medium tabular-nums text-white" aria-live="polite">
          {i + 1} / {photos.length}
        </span>
        <span className="w-[76px]" aria-hidden />
      </div>

      <div
        className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photo.id}
          src={photo.url}
          alt={`Foto ${i + 1} de ${photos.length}`}
          draggable={false}
          className="max-h-full max-w-full object-contain"
          style={{ transform: `translateX(${dx}px)`, transition: dx === 0 ? "transform 150ms ease" : "none" }}
        />
        {i > 0 && (
          <button type="button" aria-label="Foto anterior" onClick={() => go(-1)} className={`${btn} absolute left-2 top-1/2 -translate-y-1/2 !px-0 text-[24px]`}>
            ‹
          </button>
        )}
        {i < photos.length - 1 && (
          <button type="button" aria-label="Foto siguiente" onClick={() => go(1)} className={`${btn} absolute right-2 top-1/2 -translate-y-1/2 !px-0 text-[24px]`}>
            ›
          </button>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2">
        <button type="button" onClick={share} disabled={busy} className={btn}>
          {busy ? "Preparando…" : "Compartir"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
