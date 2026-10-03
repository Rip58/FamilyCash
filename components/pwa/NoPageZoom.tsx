"use client";

import { useEffect } from "react";

/**
 * Safari en iOS ignora `user-scalable=no`: bloquea el gesto de pellizcar sobre la página para que no se
 * amplíe (si se amplía, al hacer scroll se mueve todo, menú incluido). El visor de fotos hace su propio zoom.
 */
export function NoPageZoom() {
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    const pinch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    const opts = { passive: false } as const;
    document.addEventListener("gesturestart", block, opts);
    document.addEventListener("gesturechange", block, opts);
    document.addEventListener("touchmove", pinch, opts);
    return () => {
      document.removeEventListener("gesturestart", block);
      document.removeEventListener("gesturechange", block);
      document.removeEventListener("touchmove", pinch);
    };
  }, []);
  return null;
}
