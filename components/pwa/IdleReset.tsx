"use client";

import { useEffect } from "react";
import { idleExceeded } from "@/lib/idle-reset";

/**
 * Safari/WebKit en iOS, tras congelar la app en segundo plano (y más si se hace varias veces), a veces vuelve con
 * el táctil descuadrado (se toca en un sitio y responde otro) o con la página colgada. Si la app lleva un buen rato
 * sin verse (`IDLE_RESET_MS`), al volver se recarga entera: tarda un poco más pero arranca limpia.
 *
 * `lastSeen` se renueva solo mientras la app está a la vista. Al volver puede ejecutarse antes un temporizador que
 * `visibilitychange`, por eso TODOS los eventos (y el latido) pasan por `check`, que compara antes de renovar.
 */
export function IdleReset() {
  useEffect(() => {
    let lastSeen = Date.now();

    /** No tirar lo que se está escribiendo: si hay un campo con texto, se aplaza el reinicio. */
    const typing = () => {
      const el = document.activeElement;
      return (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.value.trim() !== "";
    };

    const check = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (idleExceeded(lastSeen, now) && !typing()) {
        window.location.reload();
        return;
      }
      lastSeen = now;
    };

    const onHidden = () => {
      if (document.visibilityState === "hidden") lastSeen = Date.now();
      else check();
    };

    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pageshow", check);
    window.addEventListener("focus", check);
    document.addEventListener("pointerdown", check, { capture: true, passive: true });
    const timer = window.setInterval(check, 20_000);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pageshow", check);
      window.removeEventListener("focus", check);
      document.removeEventListener("pointerdown", check, { capture: true });
      window.clearInterval(timer);
    };
  }, []);
  return null;
}
