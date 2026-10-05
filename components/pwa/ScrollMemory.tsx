"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { appScroller } from "@/lib/viewport-fix";

// Fuera del componente: sobreviven si el componente se vuelve a montar al navegar.
const positions = new Map<string, number>();
const nav = { back: false, current: "" };

// La posición se guarda al tocar (antes de que un enlace cambie de página; después Next ya ha movido el scroll).
// Al ir atrás, Next pinta la página anterior dentro de su propio `popstate`, antes que el nuestro: por eso solo
// marcamos «atrás» aquí y la página decide qué hacer un fotograma después.
if (typeof window !== "undefined") {
  document.addEventListener("pointerdown", () => positions.set(nav.current, appScroller().scrollTop), true);
  window.addEventListener("popstate", () => {
    nav.back = true;
  });
}

/**
 * El scroll de la app vive en `#app-scroll` y Next solo restaura el de window: al volver atrás (gesto o botón)
 * devolvemos la página a donde estaba. Al navegar hacia delante, la página nueva empieza arriba.
 */
export function ScrollMemory() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const key = search ? `${pathname}?${search}` : pathname;

  useEffect(() => {
    nav.current = key;
    const el = appScroller();
    let tries = 0;
    let target = 0;
    let raf = requestAnimationFrame(function first() {
      target = nav.back ? (positions.get(key) ?? 0) : 0;
      nav.back = false;
      el.scrollTop = target;
      // El contenido puede llegar después (streaming): reintenta unos fotogramas hasta poder llegar.
      raf = requestAnimationFrame(function retry() {
        if (el.scrollTop >= target - 1 || ++tries > 30) return;
        el.scrollTop = target;
        raf = requestAnimationFrame(retry);
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [key]);

  return null;
}
