"use client";

import { useState } from "react";
import { setGuestPin } from "@/app/actions/settings";
import { Card } from "@/components/ui/Card";
import { GUEST_UNTIL } from "@/lib/guest";
import { BackHeader, ConfirmButton, PrimaryButton, notify, useRun } from "./kit";

const pinInput =
  "h-14 w-32 rounded-control bg-surface-2 text-center text-[28px] font-semibold tracking-[0.4em] tabular-nums outline-none focus:ring-2 focus:ring-accent";

/**
 * Ajustes → Acceso del compañero: dirección fija /turno + PIN de 4 dígitos (se lo dices tú) para que, el día que
 * libras, otro apunte en Hoy SOLO la noche en curso, hasta las 09:30 del día siguiente.
 */
export function GuestLinkForm({
  url,
  on,
  fails,
  lockedUntil,
  autoDisabled,
}: {
  url: string;
  on: boolean;
  fails: number;
  lockedUntil: string | null;
  autoDisabled: boolean;
}) {
  const { pending, run } = useRun();
  const [pin, setPin] = useState("");
  const [changing, setChanging] = useState(false);
  const valid = /^\d{4}$/.test(pin);

  const save = () =>
    run(() => setGuestPin({ pin }), {
      msg: on ? "PIN cambiado" : "Acceso activado",
      onDone: () => {
        setPin("");
        setChanging(false);
      },
    });

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: `Turno de noche (te diré el PIN): ${url}` });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      notify("Enlace copiado");
    } catch {
      notify("No se pudo copiar", "error");
    }
  }

  const pinField = (
    <input
      aria-label="PIN de 4 números"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      maxLength={4}
      value={pin}
      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
      className={pinInput}
    />
  );

  return (
    <div>
      <BackHeader title="Acceso del compañero" />
      <div className="flex flex-col gap-4">
        <Card>
          <p className="text-[15px] leading-snug">
            Para que un compañero apunte en <b>Hoy</b> el día que libras: pasar lista (ha venido / no ha venido y si
            avisó), cambiar de puesto, «Grupo», horas extra y notas con fotos.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] text-muted">
            <li>Le pasas el enlace y le dices el PIN de 4 números.</li>
            <li>Solo la noche en curso, hasta las {GUEST_UNTIL} del día siguiente. No ve ni toca otras noches.</li>
            <li>Nada de Semana, Informe, historial, fichas, Nómina ni Ajustes.</li>
            <li>Lo que haga sale en tu Hoy de esa noche («Cambios del compañero») y sus notas con la etiqueta «Compañero».</li>
            <li>Si alguien prueba PIN al azar: 15 min de bloqueo cada 5 fallos y, a los 20, el acceso se apaga solo.</li>
          </ul>
        </Card>

        {autoDisabled && (
          <p role="alert" className="rounded-card bg-danger/10 px-4 py-3 text-[14px] font-medium text-danger">
            Se apagó solo tras {fails} intentos de PIN fallidos. Pon un PIN nuevo para volver a activarlo.
          </p>
        )}

        {on ? (
          <Card title="Activo">
            <p className="break-all rounded-control bg-surface-2 px-3 py-2 text-[15px]" aria-label="Enlace">
              {url}
            </p>
            <PrimaryButton type="button" className="mt-3 w-full" onClick={share}>
              Compartir enlace
            </PrimaryButton>
            <p className="mt-3 text-[13px] text-muted">
              El PIN no se muestra. Si no lo recuerdas, pon uno nuevo (quien entró con el anterior tendrá que meter el
              nuevo).
              {lockedUntil && <span className="font-medium text-danger"> Bloqueado por intentos fallidos hasta las {lockedUntil}.</span>}
              {!lockedUntil && fails > 0 && <span className="text-warning"> {fails} intentos fallidos seguidos.</span>}
            </p>
            {changing ? (
              <div className="mt-3 flex flex-col items-center gap-3">
                {pinField}
                <div className="grid w-full grid-cols-2 gap-2">
                  <button type="button" onClick={() => setChanging(false)} className="min-h-11 rounded-control bg-surface-2 text-[16px] font-medium">
                    Cancelar
                  </button>
                  <PrimaryButton type="button" disabled={!valid || pending} onClick={save}>
                    Guardar PIN
                  </PrimaryButton>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                <button type="button" onClick={() => setChanging(true)} className="min-h-11 rounded-control bg-surface-2 text-[16px] font-medium">
                  Cambiar PIN
                </button>
                <ConfirmButton
                  label="Apagar acceso"
                  confirmLabel="Sí, apagar"
                  disabled={pending}
                  onConfirm={() => run(() => setGuestPin({ pin: null }), { msg: "Acceso apagado" })}
                />
              </div>
            )}
          </Card>
        ) : (
          <Card title="Apagado">
            <p className="mb-3 text-[14px] text-muted">Elige un PIN de 4 números para activarlo.</p>
            <div className="flex flex-col items-center gap-3">
              {pinField}
              <PrimaryButton type="button" className="w-full" disabled={!valid || pending} onClick={save}>
                Activar
              </PrimaryButton>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
