"use client";

import { useEffect } from "react";
import { nudgeFixedLayout } from "@/lib/viewport-fix";

/** Recoloca la barra de pestañas al volver a la app, al cerrarse el teclado o al cambiar el tamaño de la ventana (iOS). */
export function FixedLayoutGuard() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(nudgeFixedLayout, 150);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") later();
    };
    const vv = window.visualViewport;
    vv?.addEventListener("resize", later);
    window.addEventListener("focus", later);
    window.addEventListener("pageshow", later);
    window.addEventListener("orientationchange", later);
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("focusout", later); // el teclado se cierra al salir de un campo
    return () => {
      clearTimeout(timer);
      vv?.removeEventListener("resize", later);
      window.removeEventListener("focus", later);
      window.removeEventListener("pageshow", later);
      window.removeEventListener("orientationchange", later);
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("focusout", later);
    };
  }, []);
  return null;
}
