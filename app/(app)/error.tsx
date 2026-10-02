"use client";

import { useEffect, useState } from "react";
import { forceUpdate } from "@/lib/app-update";

/**
 * Error de una pantalla (p. ej. la app abierta de una versión anterior tras publicar otra:
 * la acción del servidor ya no existe). "Recargar la app" trae la versión nueva.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [updating, setUpdating] = useState(false);
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 px-2 pt-16 text-center">
      <p className="text-[40px]" aria-hidden>
        ⚠️
      </p>
      <h1 className="text-[20px] font-semibold">Algo ha fallado</h1>
      <p className="max-w-xs text-[15px] text-muted">
        Si acabas de actualizar la app, recárgala para cargar la versión nueva. Lo que ya habías guardado no se pierde.
      </p>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <button
          type="button"
          disabled={updating}
          onClick={() => {
            setUpdating(true);
            void forceUpdate();
          }}
          className="min-h-12 rounded-control bg-accent text-[16px] font-semibold text-accent-fg disabled:opacity-60"
        >
          {updating ? "Actualizando…" : "Recargar la app"}
        </button>
        <button type="button" onClick={reset} className="min-h-11 text-[16px] font-medium text-accent">
          Reintentar
        </button>
      </div>
      {error.digest && <p className="text-[12px] text-muted">Código: {error.digest}</p>}
    </div>
  );
}
