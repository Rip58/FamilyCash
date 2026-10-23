"use client";

import { Card } from "@/components/ui/Card";
import { makeVacationPdf } from "@/components/vacations/SignaturesTab";
import { notify } from "@/components/ui/toast";
import { type VacationRange, rangeLabel, vacationSpan } from "@/lib/vacations";

export interface SignedVacations {
  at: string;
  ranges: VacationRange[];
  signature: string;
}

/**
 * Ficha → Datos: PIN fijo de vacaciones, el mensaje con el enlace y las vacaciones FIRMADAS (fechas + firma), con las
 * firmas anteriores guardadas para que no haya dudas de qué fechas se aprobaron.
 */
export function VacationPinCard({
  employeeId,
  workDays,
  year,
  pin,
  invite,
  status,
  pendingSignature,
  signed,
}: {
  employeeId: string;
  workDays: number;
  year: number;
  pin: string;
  invite: string | null;
  status: string | null;
  pendingSignature: boolean;
  /** Firmas, de la más nueva a la más antigua. */
  signed: SignedVacations[];
}) {
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
  const [last, ...older] = signed;
  return (
    <Card title={`Vacaciones ${year}`} className="mb-4">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <span className="text-[15px] text-muted">PIN personal</span>
        <span className="font-mono text-[22px] font-semibold tracking-[0.25em] tabular-nums" aria-label={`PIN ${pin.split("").join(" ")}`}>
          {pin}
        </span>
      </div>
      <p className="mt-1 text-[14px] text-muted">{status ?? "Todavía no ha enviado sus vacaciones."}</p>
      {pendingSignature && (
        <p className="mt-2 rounded-control bg-success/12 px-3 py-2 text-[14px] font-medium text-[#15803d]">
          Aprobadas: falta que las firme.
        </p>
      )}
      {last && (
        <section aria-label="Vacaciones firmadas" className="mt-3 rounded-control bg-surface-2 p-3">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
            Firmadas{pendingSignature ? " (antes del último cambio)" : ""}
          </h3>
          <SignedBlock s={last} />
          <button
            type="button"
            onClick={() => makeVacationPdf(year, workDays, employeeId).catch(() => notify("No se pudo crear el PDF", "error"))}
            className="mt-2 min-h-11 w-full rounded-control bg-surface text-[15px] font-medium text-accent"
          >
            PDF de su hoja firmada
          </button>
          {older.length > 0 && (
            <details className="mt-2">
              <summary className="min-h-11 cursor-pointer content-center text-[14px] font-medium text-accent">
                {older.length === 1 ? "1 firma anterior" : `${older.length} firmas anteriores`}
              </summary>
              <div className="flex flex-col gap-3 pt-1">
                {older.map((o) => (
                  <div key={o.at} className="border-t border-line pt-2">
                    <SignedBlock s={o} />
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>
      )}
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

function SignedBlock({ s }: { s: SignedVacations }) {
  return (
    <>
      <ul className="mt-1 text-[15px]">
        {s.ranges.map((r) => (
          <li key={`${r.start}${r.end}`}>
            <b>{rangeLabel(r)}</b> · descuenta {vacationSpan(r).counted}
          </li>
        ))}
      </ul>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={s.signature} alt="Firma" className="mt-2 h-24 w-full rounded-control bg-white object-contain" />
      <p className="mt-1 text-[13px] text-muted">Firmado el {s.at}</p>
    </>
  );
}
