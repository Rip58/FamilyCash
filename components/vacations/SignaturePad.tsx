"use client";

import { useEffect, useImperativeHandle, useRef, useState } from "react";

export interface SignaturePadHandle {
  /** PNG (data URL) de la firma, o null si está vacía. */
  toDataUrl: () => string | null;
  clear: () => void;
}

/** Recuadro para firmar con el dedo (o el ratón). Fondo blanco para que salga bien en el PDF. */
export function SignaturePad({ ref, onChange }: { ref: React.Ref<SignaturePadHandle>; onChange?: (hasInk: boolean) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  const reset = () => {
    const c = canvas.current;
    if (!c) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(c.clientWidth * ratio);
    c.height = Math.round(c.clientHeight * ratio);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
    setHasInk(false);
    onChange?.(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reset, []);

  useImperativeHandle(ref, () => ({
    toDataUrl: () => (hasInk && canvas.current ? canvas.current.toDataURL("image/png") : null),
    clear: reset,
  }));

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <canvas
      ref={canvas}
      aria-label="Recuadro para firmar"
      className="h-44 w-full touch-none rounded-control border-2 border-dashed border-line bg-white"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drawing.current = true;
        last.current = point(e);
      }}
      onPointerMove={(e) => {
        if (!drawing.current || !last.current) return;
        const ctx = e.currentTarget.getContext("2d");
        const p = point(e);
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(last.current.x, last.current.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        last.current = p;
        if (!hasInk) {
          setHasInk(true);
          onChange?.(true);
        }
      }}
      onPointerUp={() => {
        drawing.current = false;
        last.current = null;
      }}
      onPointerCancel={() => {
        drawing.current = false;
        last.current = null;
      }}
    />
  );
}
