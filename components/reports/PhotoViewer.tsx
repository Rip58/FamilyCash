"use client";

import { lockAppScroll } from "@/lib/viewport-fix";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { notify } from "@/components/ui/toast";
import type { ReportPhotoView } from "@/lib/report-format";

interface PhotoViewerProps {
  photos: ReportPhotoView[];
  /** Índice inicial; null = cerrado. */
  index: number | null;
  caption?: string;
  onClose: () => void;
}

/** Visor a pantalla completa: pellizcar para hacer zoom (doble toque acerca/aleja), swipe entre fotos, cerrar y compartir. */
export function PhotoViewer({ photos, index, caption, onClose }: PhotoViewerProps) {
  if (index === null || photos.length === 0) return null;
  return <Viewer photos={photos} start={index} caption={caption} onClose={onClose} />;
}

interface Zoom {
  s: number;
  x: number;
  y: number;
}
const NO_ZOOM: Zoom = { s: 1, x: 0, y: 0 };
const MAX_ZOOM = 5;
const DOUBLE_TAP_ZOOM = 2.5;

type Gesture =
  | { kind: "pinch"; dist: number; start: Zoom; mid: { x: number; y: number } }
  | { kind: "pan"; x: number; y: number; start: Zoom; moved: boolean; swipe: boolean };

function Viewer({ photos, start, caption, onClose }: { photos: ReportPhotoView[]; start: number; caption?: string; onClose: () => void }) {
  const [i, setI] = useState(Math.min(start, photos.length - 1));
  const [dx, setDx] = useState(0);
  const [zoom, setZoom] = useState<Zoom>(NO_ZOOM);
  const [gesturing, setGesturing] = useState(false);
  const [busy, setBusy] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const zoomRef = useRef<Zoom>(NO_ZOOM);
  const dxRef = useRef(0);
  const gesture = useRef<Gesture | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const photo = photos[i]!;

  const applyZoom = (z: Zoom) => {
    zoomRef.current = z;
    setZoom(z);
  };
  const go = (n: number) => {
    applyZoom(NO_ZOOM);
    setI((cur) => Math.max(0, Math.min(photos.length - 1, cur + n)));
  };

  useEffect(() => {
    const unlock = lockAppScroll();
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
      unlock();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  // Gestos con escuchas nativas (no pasivas) para que Safari no haga zoom de toda la página.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    /** Punto de la pantalla relativo al centro del visor. */
    const local = (x: number, y: number) => {
      const r = stage.getBoundingClientRect();
      return { x: x - r.left - r.width / 2, y: y - r.top - r.height / 2 };
    };
    /** Limita el desplazamiento para que la foto no se salga del visor. */
    const clamp = (z: Zoom): Zoom => {
      const img = imgRef.current;
      const r = stage.getBoundingClientRect();
      const w = (img?.offsetWidth ?? r.width) * z.s;
      const h = (img?.offsetHeight ?? r.height) * z.s;
      const mx = Math.max((w - r.width) / 2, 0);
      const my = Math.max((h - r.height) / 2, 0);
      return { s: z.s, x: Math.min(Math.max(z.x, -mx), mx), y: Math.min(Math.max(z.y, -my), my) };
    };
    /** Zoom `s` manteniendo quieto el punto `p` (relativo al centro). */
    const zoomAt = (from: Zoom, s: number, p: { x: number; y: number }, to = p): Zoom => {
      const ux = (p.x - from.x) / from.s;
      const uy = (p.y - from.y) / from.s;
      return { s, x: to.x - ux * s, y: to.y - uy * s };
    };
    const distance = (t: TouchList) => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);
    const middle = (t: TouchList) => local((t[0]!.clientX + t[1]!.clientX) / 2, (t[0]!.clientY + t[1]!.clientY) / 2);

    const onStart = (e: TouchEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      e.preventDefault();
      setGesturing(true);
      if (e.touches.length >= 2) {
        dxRef.current = 0;
        setDx(0);
        gesture.current = { kind: "pinch", dist: distance(e.touches), start: zoomRef.current, mid: middle(e.touches) };
      } else {
        const t = e.touches[0]!;
        gesture.current = { kind: "pan", x: t.clientX, y: t.clientY, start: zoomRef.current, moved: false, swipe: false };
      }
    };
    const onMove = (e: TouchEvent) => {
      const g = gesture.current;
      if (!g) return;
      e.preventDefault();
      if (g.kind === "pinch" && e.touches.length >= 2) {
        const s = Math.min(Math.max((g.start.s * distance(e.touches)) / g.dist, 1), MAX_ZOOM);
        applyZoom(zoomAt(g.start, s, g.mid, middle(e.touches)));
        return;
      }
      if (g.kind !== "pan") return;
      const t = e.touches[0]!;
      const mx = t.clientX - g.x;
      const my = t.clientY - g.y;
      if (Math.abs(mx) > 8 || Math.abs(my) > 8) g.moved = true;
      if (g.start.s > 1) {
        applyZoom(clamp({ s: g.start.s, x: g.start.x + mx, y: g.start.y + my }));
      } else if (g.swipe || (g.moved && Math.abs(mx) > Math.abs(my))) {
        g.swipe = true;
        dxRef.current = mx;
        setDx(mx);
      }
    };
    const onEnd = (e: TouchEvent) => {
      const g = gesture.current;
      if (e.touches.length > 0) {
        // Queda un dedo tras pellizcar: sigue como arrastre desde ahí.
        const t = e.touches[0]!;
        gesture.current = { kind: "pan", x: t.clientX, y: t.clientY, start: zoomRef.current, moved: true, swipe: false };
        return;
      }
      gesture.current = null;
      setGesturing(false);
      if (g?.kind === "pan" && g.swipe) {
        if (dxRef.current < -50) go(1);
        else if (dxRef.current > 50) go(-1);
      }
      dxRef.current = 0;
      setDx(0);
      const z = zoomRef.current;
      if (z.s < 1.05) applyZoom(NO_ZOOM);
      else applyZoom(clamp(z));
      // Doble toque: acercar donde se toca / volver a 1×.
      if (g?.kind === "pan" && !g.moved) {
        const now = Date.now();
        const last = lastTap.current;
        const t = e.changedTouches[0]!;
        if (last && now - last.t < 300 && Math.hypot(t.clientX - last.x, t.clientY - last.y) < 30) {
          lastTap.current = null;
          applyZoom(zoomRef.current.s > 1 ? NO_ZOOM : clamp(zoomAt(NO_ZOOM, DOUBLE_TAP_ZOOM, local(t.clientX, t.clientY))));
        } else {
          lastTap.current = { t: now, x: t.clientX, y: t.clientY };
        }
      }
    };
    // Safari: evita el zoom de página con el gesto de pellizcar.
    const block = (e: Event) => e.preventDefault();
    const opts = { passive: false } as const;
    stage.addEventListener("touchstart", onStart, opts);
    stage.addEventListener("touchmove", onMove, opts);
    stage.addEventListener("touchend", onEnd, opts);
    stage.addEventListener("touchcancel", onEnd, opts);
    stage.addEventListener("gesturestart", block, opts);
    stage.addEventListener("gesturechange", block, opts);
    return () => {
      stage.removeEventListener("touchstart", onStart);
      stage.removeEventListener("touchmove", onMove);
      stage.removeEventListener("touchend", onEnd);
      stage.removeEventListener("touchcancel", onEnd);
      stage.removeEventListener("gesturestart", block);
      stage.removeEventListener("gesturechange", block);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length]);

  async function share() {
    setBusy(true);
    try {
      const res = await fetch(photo.url);
      const blob = await res.blob();
      const file = new File([blob], `foto-${i + 1}.jpg`, { type: blob.type || "image/jpeg" });
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
        ref={stageRef}
        className="relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden"
        onDoubleClick={(e) => {
          // Ratón: doble clic para acercar/alejar.
          if ((e.target as HTMLElement).closest("button")) return;
          const r = e.currentTarget.getBoundingClientRect();
          const p = { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
          applyZoom(zoom.s > 1 ? NO_ZOOM : { s: DOUBLE_TAP_ZOOM, x: -p.x * (DOUBLE_TAP_ZOOM - 1), y: -p.y * (DOUBLE_TAP_ZOOM - 1) });
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          key={photo.id}
          src={photo.url}
          alt={`Foto ${i + 1} de ${photos.length}`}
          draggable={false}
          className="max-h-full max-w-full object-contain"
          style={{
            transform: `translate(${zoom.x + dx}px, ${zoom.y}px) scale(${zoom.s})`,
            transition: gesturing ? "none" : "transform 180ms ease",
          }}
        />
        {zoom.s === 1 && i > 0 && (
          <button type="button" aria-label="Foto anterior" onClick={() => go(-1)} className={`${btn} absolute left-2 top-1/2 -translate-y-1/2 !px-0 text-[24px]`}>
            ‹
          </button>
        )}
        {zoom.s === 1 && i < photos.length - 1 && (
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
