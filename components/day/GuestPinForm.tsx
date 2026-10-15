"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enterGuestPin } from "@/app/actions/auth";

/** /turno sin acceso todavía: PIN de 4 dígitos que te da el encargado. */
export function GuestPinForm() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await enterGuestPin({ pin }).catch(() => ({ ok: false as const, error: "Sin conexión. Inténtalo de nuevo." }));
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
      <h1 className="text-[22px] font-bold">Turno de esta noche</h1>
      <p className="text-[15px] text-muted">Escribe el PIN de 4 números que te han dado.</p>
      <input
        aria-label="PIN"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={4}
        autoFocus
        value={pin}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 4);
          setPin(v);
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
    </form>
  );
}
