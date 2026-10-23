"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enterVacationPin } from "@/app/actions/auth";

/** /vacaciones sin haber entrado: el PIN personal de 4 números (está en su ficha; se lo da el encargado). */
export function VacationPinForm({ year, deadline }: { year: number; deadline: string }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [y, m, d] = deadline.split("-");

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await enterVacationPin({ pin }).catch(() => ({ ok: false as const, error: "Sin conexión. Inténtalo de nuevo." }));
      if (r.ok) router.refresh();
      else {
        setError(r.error);
        setPin("");
      }
    });

  return (
    <form
      className="mx-auto flex min-h-[75dvh] max-w-xs flex-col items-center justify-center gap-4 px-6 text-center"
      onSubmit={(e) => {
        e.preventDefault();
        if (pin.length === 4) submit();
      }}
    >
      <h1 className="text-[26px] font-bold">Vacaciones {year}</h1>
      <p className="text-[15px] text-muted">Turno de noche · escribe tu PIN personal de 4 números.</p>
      <input
        aria-label="PIN"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={4}
        autoFocus
        value={pin}
        onChange={(e) => {
          setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
          setError(null);
        }}
        className="h-16 w-48 rounded-card bg-surface text-center text-[34px] font-semibold tracking-[0.5em] tabular-nums outline-none focus:ring-2 focus:ring-accent"
      />
      {error && (
        <p role="alert" className="text-[14px] font-medium text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pin.length !== 4 || pending}
        className="press min-h-12 w-48 rounded-control bg-accent text-[17px] font-semibold text-accent-fg disabled:opacity-40"
      >
        {pending ? "Comprobando…" : "Entrar"}
      </button>
      <p className="text-[13px] text-muted">
        Plazo para elegir: hasta el {Number(d)}/{Number(m)}/{y}
      </p>
    </form>
  );
}
