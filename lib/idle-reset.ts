/** Minutos fuera de la app a partir de los cuales, al volver, se recarga limpia (arregla el táctil descuadrado de iOS). */
export const IDLE_RESET_MS = 15 * 60_000;

/** ¿Ha pasado más tiempo del permitido desde la última vez que la app estuvo a la vista? */
export function idleExceeded(lastSeen: number, now: number, limit: number = IDLE_RESET_MS): boolean {
  return lastSeen > 0 && now - lastSeen > limit;
}
