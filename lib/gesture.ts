/**
 * Gestos de las hojas que suben desde abajo (Emil Kowalski): se cierran por distancia O por velocidad,
 * y al tirar hacia arriba ofrecen resistencia en vez de un tope seco.
 */

/** Distancia (px) a partir de la cual se cierra aunque se suelte despacio. */
export const DISMISS_DISTANCE = 100;
/** Velocidad (px/ms) a partir de la cual un gesto rápido cierra aunque sea corto. */
export const DISMISS_VELOCITY = 0.11;
/** Lo mínimo que hay que arrastrar para que un gesto rápido cuente (evita cerrar con un toque). */
const MIN_FLICK = 12;

export function shouldDismissSheet(dy: number, elapsedMs: number): boolean {
  if (dy >= DISMISS_DISTANCE) return true;
  if (dy < MIN_FLICK || elapsedMs <= 0) return false;
  return dy / elapsedMs > DISMISS_VELOCITY;
}

/** Hacia abajo sigue al dedo; hacia arriba, cada vez cuesta más (máx. ~24 px). */
export function sheetDragOffset(rawDy: number): number {
  if (rawDy >= 0) return rawDy;
  const up = -rawDy;
  return -(24 * (1 - Math.exp(-up / 60)));
}
