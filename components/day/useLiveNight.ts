"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { nightVersion } from "@/app/actions/live";
import type { DateStr } from "@/lib/dates";
import { guestNight } from "@/lib/guest";

/** Cada cuánto mira si alguien (el compañero o tú desde otro móvil) ha apuntado algo en la noche. */
const POLL_MS = 10_000;

/**
 * Hoy en vivo: mientras la app está a la vista y es la noche en curso, pregunta la huella de la noche (`nightVersion`)
 * y refresca la página si ha cambiado. No consulta con la app en segundo plano ni mientras se guarda algo (`busy`).
 */
export function useLiveNight(date: DateStr, busy: boolean) {
  const router = useRouter();
  const busyRef = useRef(busy);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    if (date !== guestNight(new Date())) return;
    let last: string | null = null;
    let stopped = false;
    let inFlight = false;
    const check = async () => {
      if (stopped || inFlight || busyRef.current || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const v = await nightVersion(date);
        if (stopped || v === null) return;
        if (last !== null && v !== last && !busyRef.current) router.refresh();
        last = v;
      } catch {
        /* sin conexión o sin permiso: se reintenta en la siguiente vuelta */
      } finally {
        inFlight = false;
      }
    };
    void check();
    const timer = setInterval(check, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [date, router]);
}
