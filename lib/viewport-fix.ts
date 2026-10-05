// Solo cliente. iOS (sobre todo la PWA instalada) a veces deja los elementos `position: fixed` (la barra de pestañas)
// a media pantalla al volver de la hoja de compartir o al cerrar el teclado: se queda con el tamaño de ventana viejo
// hasta que algo le obliga a recolocarlos. Mover el scroll 1 px y volver lo fuerza sin que se note.

let pending = 0;

export function nudgeFixedLayout(): void {
  if (typeof window === "undefined") return;
  cancelAnimationFrame(pending);
  pending = requestAnimationFrame(() => {
    const y = window.scrollY;
    window.scrollTo(window.scrollX, y > 0 ? y - 1 : y + 1);
    requestAnimationFrame(() => window.scrollTo(window.scrollX, y));
  });
}
