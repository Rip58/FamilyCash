"use client";

import { Card } from "@/components/ui/Card";
import { notify } from "@/components/ui/toast";

/** Ficha → Datos: PIN fijo de vacaciones y, cuando exista la página de los empleados, el mensaje con el enlace. */
export function VacationPinCard({ year, pin, invite }: { year: number; pin: string; invite: string | null }) {
  async function send() {
    if (!invite) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: invite });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(invite);
      notify("Mensaje copiado");
    } catch {
      notify("No se pudo copiar", "error");
    }
  }
  return (
    <Card title={`Vacaciones ${year}`} className="mb-4">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <span className="text-[15px] text-muted">PIN personal</span>
        <span className="font-mono text-[22px] font-semibold tracking-[0.25em] tabular-nums" aria-label={`PIN ${pin.split("").join(" ")}`}>
          {pin}
        </span>
      </div>
      {invite ? (
        <button
          type="button"
          onClick={send}
          className="press mt-3 min-h-11 w-full rounded-control bg-accent text-[16px] font-semibold text-accent-fg"
        >
          Mandar enlace y PIN
        </button>
      ) : (
        <p className="mt-2 text-[13px] text-muted">Es fijo. Con él entrará a elegir sus vacaciones cuando esté lista su página.</p>
      )}
    </Card>
  );
}
