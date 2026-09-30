"use client";

import { useEffect, useRef, useState } from "react";

/** Compartir el informe: Web Share API o, si no existe, copiar al portapapeles. */
export function ShareButton({ text, title }: { text: string; title: string }) {
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const flash = (msg: string) => {
    setNotice(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), 2500);
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      flash("Copiado");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      flash(ok ? "Copiado" : "No se pudo copiar");
    }
  }

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return; // el usuario canceló
      }
    }
    await copy();
  }

  return (
    <>
      <button
        type="button"
        onClick={share}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 text-[15px] font-semibold text-accent-fg active:opacity-80"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
        </svg>
        Compartir
      </button>
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+16px)] z-50 flex justify-center"
      >
        {notice && <span className="rounded-full bg-fg px-4 py-2 text-[14px] font-medium text-bg shadow-lg">{notice}</span>}
      </div>
    </>
  );
}
