// Solo cliente. El scroll de la app vive en `#app-scroll` (no en el documento): en iOS 26.0 (WebKit 297779), si el
// documento hace scroll, tras cerrar el teclado o la hoja de compartir la barra de pestañas fija se queda a media
// pantalla en todas las páginas. Ver `app/(app)/layout.tsx` y `.app-scroll` en globals.css.

let locks = 0;

/** Contenedor que hace scroll en la app (o el documento fuera de `(app)`, p. ej. el login). */
export function appScroller(): HTMLElement {
  return document.getElementById("app-scroll") ?? document.documentElement;
}

/**
 * Bloquea el scroll del fondo mientras hay una hoja o el visor de fotos abiertos. Con contador: varias hojas una
 * encima de otra se pueden cerrar en cualquier orden sin dejar el scroll bloqueado. Devuelve la función que libera.
 */
export function lockAppScroll(): () => void {
  locks++;
  const apply = () => {
    const v = locks > 0 ? "hidden" : "";
    appScroller().style.overflowY = v;
    document.body.style.overflow = v;
  };
  apply();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    apply();
  };
}
