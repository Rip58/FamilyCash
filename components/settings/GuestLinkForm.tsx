"use client";

import { useState } from "react";
import { setGuestLink } from "@/app/actions/settings";
import { Card } from "@/components/ui/Card";
import { GUEST_UNTIL } from "@/lib/guest";
import { BackHeader, ConfirmButton, PrimaryButton, notify, useRun } from "./kit";

/**
 * Ajustes → Enlace del compañero: un enlace sin contraseña para que, el día que libras, otro apunte en Hoy
 * (pasar lista, puestos, Grupo, horas extra y notas) SOLO la noche en curso, hasta las 09:30 del día siguiente.
 */
export function GuestLinkForm({ origin, token }: { origin: string; token: string | null }) {
  const { pending, run } = useRun();
  const [current, setCurrent] = useState(token);
  const url = current ? `${origin}/t/${current}` : null;

  const set = (on: boolean, msg: string) =>
    run(() => setGuestLink({ on }), { msg, onDone: (r) => setCurrent(r.token) });

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      notify("Enlace copiado");
    } catch {
      notify("No se pudo copiar", "error");
    }
  }
  async function share() {
    if (!url) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: `Hoy de la plantilla (turno de noche): ${url}` });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    await copy();
  }

  return (
    <div>
      <BackHeader title="Enlace del compañero" />
      <div className="flex flex-col gap-4">
        <Card>
          <p className="text-[15px] leading-snug">
            Para que un compañero apunte en <b>Hoy</b> el día que libras: pasar lista (ha venido / no ha venido y si
            avisó), cambiar de puesto, «Grupo», horas extra y notas con fotos.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] text-muted">
            <li>Sin contraseña: quien tenga el enlace, entra.</li>
            <li>Solo la noche en curso, hasta las {GUEST_UNTIL} del día siguiente. No ve ni toca otras noches.</li>
            <li>Nada de Semana, Informe, historial, fichas, Nómina ni Ajustes.</li>
            <li>Lo que haga sale en tu Hoy de esa noche («Cambios del compañero») y sus notas con la etiqueta «Compañero».</li>
          </ul>
        </Card>

        {url ? (
          <Card title="Enlace activo">
            <p className="break-all rounded-control bg-surface-2 px-3 py-2 text-[14px] tabular-nums" aria-label="Enlace">
              {url}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <PrimaryButton type="button" onClick={share} disabled={pending}>
                Compartir
              </PrimaryButton>
              <button type="button" onClick={copy} className="min-h-11 rounded-control bg-surface-2 text-[16px] font-medium">
                Copiar
              </button>
            </div>
            <p className="mt-3 text-[13px] text-muted">
              Si se ha pasado a quien no debe, cámbialo: el anterior deja de funcionar al momento.
            </p>
            <div className="mt-2 flex flex-col gap-2">
              <ConfirmButton label="Cambiar enlace" confirmLabel="Sí, cambiar" disabled={pending} onConfirm={() => set(true, "Enlace nuevo creado")} />
              <ConfirmButton label="Apagar enlace" confirmLabel="Sí, apagar" disabled={pending} onConfirm={() => set(false, "Enlace apagado")} />
            </div>
          </Card>
        ) : (
          <Card title="Apagado">
            <p className="mb-3 text-[14px] text-muted">Ahora mismo nadie puede entrar sin contraseña.</p>
            <PrimaryButton type="button" className="w-full" disabled={pending} onClick={() => set(true, "Enlace creado")}>
              Crear enlace
            </PrimaryButton>
          </Card>
        )}
      </div>
    </div>
  );
}
