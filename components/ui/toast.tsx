"use client";

import { useEffect, useState } from "react";
import { cn } from "./cn";

/** Avisos breves ("Guardado", errores). Aparte del kit de Ajustes para no cargar dnd-kit en todas las páginas. */

type ToastMsg = { id: number; text: string; kind: "ok" | "error" };
const listeners = new Set<(t: ToastMsg) => void>();
let toastId = 0;

export function notify(text: string, kind: "ok" | "error" = "ok") {
  const t = { id: ++toastId, text, kind };
  listeners.forEach((l) => l(t));
}

/** Aviso discreto en la parte inferior (encima de la barra de pestañas). */
export function Toaster() {
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const l = (t: ToastMsg) => {
      setLeaving(false);
      setToast(t);
    };
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const shown = toast.kind === "error" ? 4000 : 1400;
    // Sale con su transición (150 ms) y luego se desmonta.
    const out = setTimeout(() => setLeaving(true), shown);
    const gone = setTimeout(() => setToast(null), shown + 160);
    return () => {
      clearTimeout(out);
      clearTimeout(gone);
    };
  }, [toast]);
  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
      style={{ bottom: "calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 12px)" }}
    >
      <div
        key={toast.id}
        data-leaving={leaving ? "" : undefined}
        className={cn(
          "toast-pop rounded-full px-4 py-2 text-[14px] font-medium text-white shadow-lg",
          toast.kind === "ok" ? "bg-[#1c1c1e]/90" : "bg-danger",
        )}
      >
        {toast.kind === "ok" ? "✓ " : ""}
        {toast.text}
      </div>
    </div>
  );
}

