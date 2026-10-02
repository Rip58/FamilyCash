"use client";

import { useEffect, useState } from "react";
import { notify } from "@/components/ui/toast";
import { fetchServerVersion, finishUpdate, forceUpdate } from "@/lib/app-update";
import { CLIENT_VERSION } from "@/lib/version";

const CHECK_EVERY_MS = 10 * 60_000;
const MIN_GAP_MS = 60_000;

/**
 * Comprueba si hay una versión nueva publicada (al abrir, al volver a la app y cada 10 min) y,
 * si la hay, muestra un aviso arriba con "Actualizar". También remata un "Forzar actualización" pendiente.
 */
export function UpdateBanner() {
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const result = finishUpdate();
    // En el siguiente tick: el Toaster aún no escucha durante este primer efecto.
    if (result === "ok") setTimeout(() => notify("App actualizada a la última versión"), 0);
    else if (result === "failed")
      setTimeout(() => notify("No se pudo actualizar del todo: cierra la app por completo y vuelve a abrirla.", "error"), 0);
    if (result === "retry" || CLIENT_VERSION === "dev") return;

    let last = 0;
    const check = async () => {
      if (Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      const server = await fetchServerVersion();
      if (server && server.version !== "dev" && server.version !== CLIENT_VERSION) setNewVersion(server.version);
    };
    void check();
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => void check(), CHECK_EVERY_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, []);

  if (!newVersion) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 z-50 mx-auto flex max-w-xl items-center gap-3 px-3"
      style={{ top: "calc(env(safe-area-inset-top) + 8px)" }}
    >
      <div className="flex min-h-12 flex-1 items-center gap-3 rounded-card bg-accent px-4 py-2 text-accent-fg shadow-lg">
        <span className="flex-1 text-[15px] font-medium">Hay una versión nueva de la app</span>
        <button
          type="button"
          disabled={updating}
          onClick={() => {
            setUpdating(true);
            void forceUpdate(newVersion);
          }}
          className="min-h-10 rounded-control bg-white px-3 text-[15px] font-semibold text-accent disabled:opacity-60"
        >
          {updating ? "Actualizando…" : "Actualizar"}
        </button>
        <button
          type="button"
          aria-label="Ahora no"
          onClick={() => setNewVersion(null)}
          className="flex min-h-10 min-w-10 items-center justify-center text-[18px] text-accent-fg/80"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
